// Importa el reporte "Requerimientos de Mis Clientes" de la plataforma de requerimientos
// (.xlsx o .csv) a la pestaña Requerimientos_Plataforma.
//
// Uso:
//   npm run import-requerimientos -- --dry-run "C:\ruta\Requerimientos_de_Mis_Clientes-....xlsx"
//   npm run import-requerimientos -- "C:\ruta\Requerimientos_de_Mis_Clientes-....xlsx"
//
// Es reimportable: los requerimientos que ya existen (mismo ID) se ACTUALIZAN con su estado
// más reciente y los nuevos se agregan. Nunca borra filas.
import { basename } from "node:path";
import { google } from "googleapis";
import { readTabular } from "./lib/tabular.mjs";

const SHEET = "Requerimientos_Plataforma";
const HEADERS = [
  "ID", "Titulo", "Estado", "Etapa", "Cliente", "Producto", "Impuesto", "Modulo", "Asignado_A", "Reportado_Por",
  "Prioridad", "Creado", "Actualizado", "Inicio_Desarrollo", "Ultimo_QA", "Enviado_Comite", "Ultima_Transicion",
  "Dias_Abiertos", "Fecha_Importacion",
];
// Columnas del reporte → columnas de la hoja
const MAPA = {
  ID: "ID", "Título": "Titulo", Estado: "Estado", Etapa: "Etapa", Cliente: "Cliente", Producto: "Producto",
  Impuesto: "Impuesto", "Módulo": "Modulo", "Asignado a": "Asignado_A", "Reportado por": "Reportado_Por",
  Prioridad: "Prioridad", Creado: "Creado", Actualizado: "Actualizado", "Inicio Desarrollo": "Inicio_Desarrollo",
  "Último QA": "Ultimo_QA", "Enviado a Comité": "Enviado_Comite", "Última transición": "Ultima_Transicion",
  "Días abiertos": "Dias_Abiertos",
};
const FECHAS = new Set(["Creado", "Actualizado", "Inicio_Desarrollo", "Ultimo_QA", "Enviado_Comite", "Ultima_Transicion"]);

/** "04/11/2026 2:41 P.M." → "2026-11-04 14:41" (ordenable y sin ambigüedad). */
function fechaHora(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d+(\.\d+)?$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400000));
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?)?/.exec(s);
  if (!m) return s;
  let h = Number(m[4] ?? 0);
  if (m[6]) {
    const pm = m[6].toLowerCase() === "p";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  const hh = m[4] ? ` ${String(h).padStart(2, "0")}:${m[5]}` : "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}${hh}`;
}
const nombre = (s) =>
  String(s ?? "").trim().toLowerCase().replace(/(^|\s|-)\p{L}/gu, (c) => c.toUpperCase()); // "LAURA OROZCO" → "Laura Orozco"
const a1 = (s, r) => `'${s}'!${r}`;
const colLetter = (n) => { let s = ""; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const sanitize = (v) => { const s = v == null ? "" : String(v); return /^[=+\-@]/.test(s) ? `'${s}` : s; };

// ── Leer y mapear ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const paths = args.filter((a) => a !== "--dry-run");
if (!paths.length) {
  console.error('Uso: npm run import-requerimientos -- [--dry-run] "Requerimientos_de_Mis_Clientes.xlsx"');
  process.exit(1);
}
const ahora = new Date().toISOString().slice(0, 16).replace("T", " ");
const entrantes = new Map();
for (const p of paths) {
  const rows = readTabular(p);
  const head = rows[0].map((h) => String(h).trim());
  if (!head.includes("ID") || !head.includes("Título")) throw new Error(`${basename(p)}: no parece un reporte de requerimientos (faltan ID/Título)`);
  for (const r of rows.slice(1)) {
    const reg = { Fecha_Importacion: ahora };
    head.forEach((h, i) => {
      const k = MAPA[h];
      if (!k) return;
      let v = String(r[i] ?? "").trim();
      if (FECHAS.has(k)) v = fechaHora(v);
      if (k === "Asignado_A" || k === "Reportado_Por") v = nombre(v);
      if (k === "Prioridad") v = v.toLowerCase();
      reg[k] = v;
    });
    if (reg.ID) entrantes.set(reg.ID, reg);
  }
  console.log(`${basename(p)}: ${rows.length - 1} requerimientos`);
}

// ── Google Sheets ─────────────────────────────────────────────────────────
const { GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId, GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: key } = process.env;
if (!spreadsheetId || !email || !key) {
  console.error("Faltan variables GOOGLE_* en .env.local");
  process.exit(1);
}
const auth = new google.auth.JWT({ email, key: key.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
const existe = meta.data.sheets.some((s) => s.properties.title === SHEET);
let actuales = [];
if (existe) actuales = (await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(SHEET, "A:Z") })).data.values ?? [];
const headActual = (actuales[0] ?? []).map((h) => String(h).trim());
const headers = [...headActual, ...HEADERS.filter((h) => !headActual.includes(h))];
const iId = headers.indexOf("ID");
const filaPorId = new Map(actuales.slice(1).map((r, i) => [String(r[iId] ?? "").trim(), i + 2]));

const actualizar = [];
const nuevos = [];
let sinCambios = 0;
for (const [id, reg] of entrantes) {
  const fila = filaPorId.get(id);
  if (!fila) { nuevos.push(reg); continue; }
  const prev = actuales[fila - 1];
  const cambia = HEADERS.some((h) => h !== "Fecha_Importacion" && (reg[h] ?? "") !== String(prev[headers.indexOf(h)] ?? ""));
  if (cambia) actualizar.push({ fila, reg: { ...Object.fromEntries(headers.map((h, i) => [h, prev[i] ?? ""])), ...reg } });
  else sinCambios++;
}

const porEtapa = {};
for (const r of entrantes.values()) porEtapa[r.Etapa || "(sin etapa)"] = (porEtapa[r.Etapa || "(sin etapa)"] ?? 0) + 1;
console.log(`\nNuevos: ${nuevos.length} · Actualizados: ${actualizar.length} · Sin cambios: ${sinCambios}`);
console.table(porEtapa);

if (dryRun) {
  console.log("\n(--dry-run) No se escribió nada. Ejemplo:", JSON.stringify(nuevos[0] ?? actualizar[0]?.reg, null, 2));
  process.exit(0);
}

if (!existe) {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] } });
  console.log(`Pestaña ${SHEET} creada`);
}
if (headers.length !== headActual.length) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1(SHEET, `${colLetter(headActual.length)}1`),
    valueInputOption: "RAW",
    requestBody: { values: [headers.slice(headActual.length)] },
  });
}
if (actualizar.length) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: actualizar.map(({ fila, reg }) => ({ range: a1(SHEET, `A${fila}`), values: [headers.map((h) => sanitize(reg[h]))] })),
    },
  });
}
if (nuevos.length) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1(SHEET, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: nuevos.map((r) => headers.map((h) => sanitize(r[h]))) },
  });
}
console.log(`✔ ${nuevos.length} nuevos y ${actualizar.length} actualizados en ${SHEET}`);
