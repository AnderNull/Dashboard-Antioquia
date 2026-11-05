import { google, type sheets_v4 } from "googleapis";
import type { Bloqueo, Levantamiento, RequerimientoPlataforma, Tarea, Usuario } from "./types";
import { construirCatalogos, type Catalogos, type ItemCatalogo } from "./catalogos";

/**
 * Conector de Google Sheets (API v4) vía Service Account.
 * Cada pestaña es una "tabla": la fila 1 contiene los encabezados y cada fila
 * siguiente es un registro. El mapeo fila <-> objeto se hace por nombre de
 * encabezado, así que el orden de las columnas en la hoja puede cambiar.
 * Solo debe importarse desde código de servidor.
 */

export const SHEETS = {
  usuarios: "Usuarios_Autorizados",
  tareas: "Proyectos_Tareas",
  levantamientos: "Levantamientos",
  bloqueos: "Bloqueos_Log",
  config: "Configuracion",
  requerimientos: "Requerimientos_Plataforma",
} as const;

export type SheetName = (typeof SHEETS)[keyof typeof SHEETS];

export const HEADERS: Record<SheetName, string[]> = {
  Usuarios_Autorizados: ["ID", "Nombre", "Email", "PasswordHash", "Rol", "Estado", "Permisos"],
  Proyectos_Tareas: [
    "ID", "Proyecto", "Requerimiento/Tarea", "Modulo_Taxation", "Estado", "Prioridad",
    "Responsable", "Fecha_Inicio", "Fecha_Entrega", "Bloqueado", "Detalle_Bloqueo", "Fecha_Creacion",
    "Descripcion", "Fecha_Finalizacion", "Checklist", "Checklist_Progreso", "Etiquetas", "Origen",
  ],
  Levantamientos: [
    "ID", "Codigo_Requerimiento", "Descripcion_Gobernacion", "Modulo_Afectado",
    "Impacto_Tributario", "Estado_Aprobacion", "Fecha_Levantamiento",
  ],
  Bloqueos_Log: [
    "ID", "Tarea_ID", "Tipo_Bloqueo", "Descripcion_Bloqueo", "Fecha_Registro", "Fecha_Resolucion", "Estado",
  ],
  Configuracion: ["ID", "Tipo", "Valor", "Descripcion", "Orden", "Estado"],
  Requerimientos_Plataforma: [
    "ID", "Titulo", "Estado", "Etapa", "Cliente", "Producto", "Impuesto", "Modulo", "Asignado_A", "Reportado_Por",
    "Prioridad", "Creado", "Actualizado", "Inicio_Desarrollo", "Ultimo_QA", "Enviado_Comite", "Ultima_Transicion",
    "Dias_Abiertos", "Fecha_Importacion",
  ],
};

type Row = Record<string, string>;

export class SheetsConfigError extends Error {}

let client: sheets_v4.Sheets | null = null;
const sheetIdCache = new Map<string, number>();

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!spreadsheetId || !email || !key) {
    throw new SheetsConfigError(
      "Faltan variables de Google Sheets (GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).",
    );
  }
  return { spreadsheetId, email, key: key.replace(/\\n/g, "\n") };
}

function sheets() {
  if (client) return client;
  const { email, key } = getConfig();
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  client = google.sheets({ version: "v4", auth });
  return client;
}

/** Escapa el nombre de la pestaña para notación A1. */
const a1 = (sheet: string, range = "A:Z") => `'${sheet.replace(/'/g, "''")}'!${range}`;

/** Evita inyección de fórmulas (=, +, -, @) al escribir texto de usuarios. */
function sanitizeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

/** Fila leída + su número real en la hoja (base 1), para no desfasarse si hay filas vacías. */
type SheetRow = { row: Row; rowNumber: number };

type Table = { headers: string[]; rows: Row[]; entries: SheetRow[] };

// Caché corta de lecturas: cambiar de sección no vuelve a consultar Google Sheets
// si los datos tienen menos de READ_TTL_MS. Las escrituras leen siempre en fresco
// (para ubicar la fila correcta) e invalidan la caché de esa pestaña.
const READ_TTL_MS = 15_000;
const readCache = new Map<SheetName, { at: number; data: Promise<Table> }>();

function invalidar(sheet: SheetName) {
  readCache.delete(sheet);
  if (sheet === SHEETS.usuarios) usuariosCache = null;
}

async function readTable(sheet: SheetName, fresh = false): Promise<Table> {
  const hit = readCache.get(sheet);
  if (!fresh && hit && Date.now() - hit.at < READ_TTL_MS) return hit.data;
  const data = fetchTable(sheet);
  readCache.set(sheet, { at: Date.now(), data });
  data.catch(() => readCache.delete(sheet)); // no guardar errores en caché
  return data;
}

async function fetchTable(sheet: SheetName): Promise<Table> {
  const { spreadsheetId } = getConfig();
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId,
    range: a1(sheet),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (res.data.values ?? []) as string[][];
  if (values.length === 0) return { headers: HEADERS[sheet], rows: [], entries: [] };
  const headers = values[0].map((h) => String(h).trim());
  const entries: SheetRow[] = [];
  values.slice(1).forEach((r, i) => {
    if (!r.some((c) => String(c ?? "").trim() !== "")) return; // ignora filas vacías
    entries.push({
      row: Object.fromEntries(headers.map((h, j) => [h, String(r[j] ?? "").trim()])),
      rowNumber: i + 2, // +1 por el encabezado, +1 porque la hoja es base 1
    });
  });
  return { headers, rows: entries.map((e) => e.row), entries };
}

async function getSheetId(sheet: SheetName): Promise<number> {
  const cached = sheetIdCache.get(sheet);
  if (cached !== undefined) return cached;
  const { spreadsheetId } = getConfig();
  const meta = await sheets().spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  for (const s of meta.data.sheets ?? []) {
    if (s.properties?.title && s.properties.sheetId != null) {
      sheetIdCache.set(s.properties.title, s.properties.sheetId);
    }
  }
  const id = sheetIdCache.get(sheet);
  if (id === undefined) throw new Error(`La pestaña "${sheet}" no existe en el Spreadsheet.`);
  return id;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export const today = () => new Date().toISOString().slice(0, 10);

// ── CRUD genérico ────────────────────────────────────────────

export async function listRows<T>(sheet: SheetName): Promise<T[]> {
  const { rows } = await readTable(sheet);
  return rows as unknown as T[];
}

export async function appendRow(sheet: SheetName, data: Row): Promise<void> {
  const { spreadsheetId } = getConfig();
  await ensureHeadersOnce(sheet);
  const { headers } = await readTable(sheet, true);
  await sheets().spreadsheets.values.append({
    spreadsheetId,
    range: a1(sheet, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [headers.map((h) => sanitizeCell(data[h]))] },
  });
  invalidar(sheet);
}

/** Actualiza (merge) la fila cuyo ID coincida. Devuelve la fila resultante o null. */
export async function updateRow(sheet: SheetName, id: string, patch: Row): Promise<Row | null> {
  const { spreadsheetId } = getConfig();
  await ensureHeadersOnce(sheet);
  const { headers, entries } = await readTable(sheet, true);
  const found = entries.find((e) => e.row.ID === id);
  if (!found) return null;
  const merged: Row = { ...found.row, ...patch, ID: id };
  const { rowNumber } = found;
  await sheets().spreadsheets.values.update({
    spreadsheetId,
    range: a1(sheet, `A${rowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [headers.map((h) => sanitizeCell(merged[h]))] },
  });
  invalidar(sheet);
  return merged;
}

export async function deleteRow(sheet: SheetName, id: string): Promise<boolean> {
  const { spreadsheetId } = getConfig();
  const { entries } = await readTable(sheet, true);
  const found = entries.find((e) => e.row.ID === id);
  if (!found) return false;
  const sheetId = await getSheetId(sheet);
  // deleteDimension usa índices base 0: la fila N de la hoja es el índice N-1
  const start = found.rowNumber - 1;
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: start, endIndex: start + 1 } } },
      ],
    },
  });
  invalidar(sheet);
  return true;
}

/** Crea las pestañas faltantes y escribe los encabezados si la fila 1 está vacía. */
export async function ensureSchema(): Promise<string[]> {
  const { spreadsheetId } = getConfig();
  const meta = await sheets().spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));
  const missing = (Object.keys(HEADERS) as SheetName[]).filter((s) => !existing.has(s));
  if (missing.length) {
    await sheets().spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
    });
  }
  for (const sheet of Object.keys(HEADERS) as SheetName[]) await ensureHeaders(sheet);
  return missing;
}

// Verifica columnas nuevas una sola vez por proceso antes de la primera escritura.
const headersVerificados = new Set<SheetName>();
async function ensureHeadersOnce(sheet: SheetName) {
  if (headersVerificados.has(sheet)) return;
  await ensureHeaders(sheet);
  headersVerificados.add(sheet);
}

/**
 * Escribe los encabezados si la fila 1 está vacía y agrega al final las columnas
 * nuevas que falten (p. ej. "Permisos" en hojas creadas con una versión anterior).
 */
export async function ensureHeaders(sheet: SheetName): Promise<void> {
  const { spreadsheetId } = getConfig();
  const res = await sheets().spreadsheets.values.get({ spreadsheetId, range: a1(sheet, "1:1") });
  const current = (res.data.values?.[0] ?? []).map((h) => String(h).trim());
  if (!current.some(Boolean)) {
    await sheets().spreadsheets.values.update({
      spreadsheetId,
      range: a1(sheet, "A1"),
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS[sheet]] },
    });
    return;
  }
  const faltantes = HEADERS[sheet].filter((h) => !current.includes(h));
  if (!faltantes.length) return;
  const col = (n: number) => {
    let s = "";
    for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  await sheets().spreadsheets.values.update({
    spreadsheetId,
    range: a1(sheet, `${col(current.length)}1`),
    valueInputOption: "RAW",
    requestBody: { values: [faltantes] },
  });
  invalidar(sheet);
}

// ── Accesos tipados por dominio ─────────────────────────────

export const getUsuarios = () => listRows<Usuario>(SHEETS.usuarios);
export const getTareas = () => listRows<Tarea>(SHEETS.tareas);
export const getLevantamientos = () => listRows<Levantamiento>(SHEETS.levantamientos);
export const getBloqueos = () => listRows<Bloqueo>(SHEETS.bloqueos);

/** Crea la pestaña si no existe y asegura sus encabezados. */
export async function ensureSheet(sheet: SheetName): Promise<void> {
  const { spreadsheetId } = getConfig();
  const meta = await sheets().spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const existe = (meta.data.sheets ?? []).some((s) => s.properties?.title === sheet);
  if (!existe) {
    await sheets().spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheet } } }] },
    });
    sheetIdCache.clear();
  }
  await ensureHeaders(sheet);
}

/** Elementos de la pestaña Configuracion. La crea automáticamente la primera vez. */
export async function getItemsCatalogo(): Promise<ItemCatalogo[]> {
  try {
    return await listRows<ItemCatalogo>(SHEETS.config);
  } catch (e) {
    if (e instanceof SheetsConfigError) throw e;
    await ensureSheet(SHEETS.config);
    return [];
  }
}

/** Requerimientos importados de la plataforma. Vacío si aún no se ha importado ninguno. */
export async function getRequerimientos(): Promise<RequerimientoPlataforma[]> {
  try {
    return await listRows<RequerimientoPlataforma>(SHEETS.requerimientos);
  } catch (e) {
    if (e instanceof SheetsConfigError) throw e;
    return [];
  }
}

export async function getCatalogos(): Promise<Catalogos> {
  return construirCatalogos(await getItemsCatalogo());
}

export async function findUsuarioByEmail(email: string): Promise<Usuario | null> {
  const usuarios = await getUsuarios();
  const target = email.trim().toLowerCase();
  return usuarios.find((u) => u.Email.trim().toLowerCase() === target) ?? null;
}

// Caché corta de usuarios: la sesión revalida rol, estado y permisos en cada petición
// sin consultar la hoja cada vez.
const USUARIOS_TTL_MS = 30_000;
let usuariosCache: { at: number; data: Usuario[] } | null = null;

/** Busca por ID (estable aunque cambie el correo) y, si no hay ID, por correo. */
export async function findUsuarioCached({ id, email }: { id?: string; email?: string | null }): Promise<Usuario | null> {
  if (!usuariosCache || Date.now() - usuariosCache.at > USUARIOS_TTL_MS) {
    usuariosCache = { at: Date.now(), data: await getUsuarios() };
  }
  if (id) return usuariosCache.data.find((u) => u.ID === id) ?? null;
  const target = (email ?? "").trim().toLowerCase();
  return target ? (usuariosCache.data.find((u) => u.Email.trim().toLowerCase() === target) ?? null) : null;
}

/** Llamar después de modificar usuarios para que los cambios apliquen de inmediato. */
export function invalidarUsuarios() {
  usuariosCache = null;
}

/** Carga todo el estado del proyecto en paralelo. */
export async function getProjectData() {
  const [tareas, levantamientos, bloqueos] = await Promise.all([getTareas(), getLevantamientos(), getBloqueos()]);
  return { tareas, levantamientos, bloqueos };
}
