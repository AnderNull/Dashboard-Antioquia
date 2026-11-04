import { google, type sheets_v4 } from "googleapis";
import type { Bloqueo, Levantamiento, Tarea, Usuario } from "./types";

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
} as const;

export type SheetName = (typeof SHEETS)[keyof typeof SHEETS];

export const HEADERS: Record<SheetName, string[]> = {
  Usuarios_Autorizados: ["ID", "Nombre", "Email", "PasswordHash", "Rol", "Estado"],
  Proyectos_Tareas: [
    "ID", "Proyecto", "Requerimiento/Tarea", "Modulo_Taxation", "Estado", "Prioridad",
    "Responsable", "Fecha_Inicio", "Fecha_Entrega", "Bloqueado", "Detalle_Bloqueo", "Fecha_Creacion",
  ],
  Levantamientos: [
    "ID", "Codigo_Requerimiento", "Descripcion_Gobernacion", "Modulo_Afectado",
    "Impacto_Tributario", "Estado_Aprobacion", "Fecha_Levantamiento",
  ],
  Bloqueos_Log: [
    "ID", "Tarea_ID", "Tipo_Bloqueo", "Descripcion_Bloqueo", "Fecha_Registro", "Fecha_Resolucion", "Estado",
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

async function readTable(sheet: SheetName): Promise<{ headers: string[]; rows: Row[] }> {
  const { spreadsheetId } = getConfig();
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId,
    range: a1(sheet),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (res.data.values ?? []) as string[][];
  if (values.length === 0) return { headers: HEADERS[sheet], rows: [] };
  const headers = values[0].map((h) => String(h).trim());
  const rows = values
    .slice(1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? "").trim()])));
  return { headers, rows };
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
  const { headers } = await readTable(sheet);
  await sheets().spreadsheets.values.append({
    spreadsheetId,
    range: a1(sheet, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [headers.map((h) => sanitizeCell(data[h]))] },
  });
}

/** Actualiza (merge) la fila cuyo ID coincida. Devuelve la fila resultante o null. */
export async function updateRow(sheet: SheetName, id: string, patch: Row): Promise<Row | null> {
  const { spreadsheetId } = getConfig();
  const { headers, rows } = await readTable(sheet);
  const idx = rows.findIndex((r) => r.ID === id);
  if (idx === -1) return null;
  const merged: Row = { ...rows[idx], ...patch, ID: id };
  const rowNumber = idx + 2; // +1 por encabezado, +1 por base 1
  await sheets().spreadsheets.values.update({
    spreadsheetId,
    range: a1(sheet, `A${rowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [headers.map((h) => sanitizeCell(merged[h]))] },
  });
  return merged;
}

export async function deleteRow(sheet: SheetName, id: string): Promise<boolean> {
  const { spreadsheetId } = getConfig();
  const { rows } = await readTable(sheet);
  const idx = rows.findIndex((r) => r.ID === id);
  if (idx === -1) return false;
  const sheetId = await getSheetId(sheet);
  await sheets().spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: idx + 1, endIndex: idx + 2 } } },
      ],
    },
  });
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
  for (const sheet of Object.keys(HEADERS) as SheetName[]) {
    const res = await sheets().spreadsheets.values.get({ spreadsheetId, range: a1(sheet, "1:1") });
    if (!res.data.values?.[0]?.length) {
      await sheets().spreadsheets.values.update({
        spreadsheetId,
        range: a1(sheet, "A1"),
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS[sheet]] },
      });
    }
  }
  return missing;
}

// ── Accesos tipados por dominio ─────────────────────────────

export const getUsuarios = () => listRows<Usuario>(SHEETS.usuarios);
export const getTareas = () => listRows<Tarea>(SHEETS.tareas);
export const getLevantamientos = () => listRows<Levantamiento>(SHEETS.levantamientos);
export const getBloqueos = () => listRows<Bloqueo>(SHEETS.bloqueos);

export async function findUsuarioByEmail(email: string): Promise<Usuario | null> {
  const usuarios = await getUsuarios();
  const target = email.trim().toLowerCase();
  return usuarios.find((u) => u.Email.trim().toLowerCase() === target) ?? null;
}

/** Carga todo el estado del proyecto en paralelo. */
export async function getProjectData() {
  const [tareas, levantamientos, bloqueos] = await Promise.all([getTareas(), getLevantamientos(), getBloqueos()]);
  return { tareas, levantamientos, bloqueos };
}
