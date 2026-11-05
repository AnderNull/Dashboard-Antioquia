// Importa tareas exportadas de Microsoft Planner (.xlsx o .csv) a la pestaña Proyectos_Tareas.
//
// Uso:
//   npm run import-planner -- --dry-run "C:\ruta\Impuesto Vehicular.xlsx" "C:\ruta\Tasa de Seguridad.xlsx"
//   npm run import-planner -- "C:\ruta\Impuesto Vehicular.xlsx" ...
//
// - El nombre del archivo se usa como módulo Taxation ("Impuesto Vehicular (1).xlsx" → "Impuesto Vehicular").
// - No duplica: omite tareas cuyo nombre ya exista en el mismo módulo.
// - Agrega a la hoja las columnas nuevas que falten y registra los módulos en Configuracion.
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { inflateRawSync } from "node:zlib";
import { google } from "googleapis";

// ── Lectura de .xlsx sin dependencias (zip + XML) ──────────────────────────
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Archivo .xlsx no válido");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + size);
    files[name] = method === 8 ? inflateRawSync(data) : data;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
const colIndex = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function readXlsx(path) {
  const files = unzip(readFileSync(path));
  const shared = files["xl/sharedStrings.xml"]
    ? [...files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
    : [];
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  const xml = files[sheetName].toString("utf8");
  const rows = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const vals = [];
    for (const c of r[1].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      const inner = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let val = "";
      if (type === "s" && v !== undefined) val = shared[Number(v)];
      else if (type === "inlineStr") val = texts(inner);
      else if (v !== undefined) val = decode(v);
      vals[ref ? colIndex(ref) : vals.length] = val;
    }
    rows.push(Array.from(vals, (x) => x ?? ""));
  }
  return rows;
}

function readCsv(path) {
  let text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = [[]];
  let cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { rows.at(-1).push(cur); cur = ""; }
    else if (ch === "\n") { rows.at(-1).push(cur.replace(/\r$/, "")); rows.push([]); cur = ""; }
    else cur += ch;
  }
  if (cur || rows.at(-1).length) rows.at(-1).push(cur);
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ── Mapeo Planner → Proyectos_Tareas ──────────────────────────────────────
const ALIAS = {
  nombre: ["Nombre de la tarea", "Task Name"],
  estado: ["Estado", "Progress"],
  prioridad: ["Priority", "Prioridad"],
  creacion: ["Fecha de creación", "Created Date"],
  vencimiento: ["Fecha de vencimiento", "Due Date"],
  inicio: ["Fecha de inicio", "Start Date"],
  finalizacion: ["Fecha de finalización", "Completed Date"],
  checkHechos: ["Elementos de la lista de comprobación completados", "Completed Checklist Items"],
  checkItems: ["Elementos de la lista de comprobación", "Checklist Items"],
  etiquetas: ["Etiquetas", "Labels"],
  notas: ["Notas", "Description"],
  asignado: ["Asignado a", "Assigned To"],
  deposito: ["Nombre del depósito", "Bucket Name"],
};
const ESTADO = { completado: "Completado", completed: "Completado", "en curso": "En Progreso", "in progress": "En Progreso", "no iniciado": "Por Hacer", "not started": "Por Hacer" };
const PRIORIDAD = { urgente: "Alta", urgent: "Alta", importante: "Alta", important: "Alta", media: "Media", medium: "Media", baja: "Baja", low: "Baja" };

function fecha(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d+(\.\d+)?$/.test(s)) return new Date(Math.round((Number(s) - 25569) * 86400000)).toISOString().slice(0, 10); // serial de Excel
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

const moduloDeArchivo = (path) => basename(path, extname(path)).replace(/\s*\(\d+\)\s*$/, "").trim();
const codigoModulo = (m) =>
  m.split(/\s+/).filter((w) => !/^(de|del|la|las|los|y)$/i.test(w)).map((w) => w[0].toUpperCase()).join("").slice(0, 4) || "PL";

function mapear(path, rows, hoy) {
  const header = rows[0].map((h) => String(h).trim());
  const col = (k) => ALIAS[k].map((a) => header.indexOf(a)).find((i) => i >= 0) ?? -1;
  const get = (r, k) => (col(k) >= 0 ? String(r[col(k)] ?? "").trim() : "");
  if (col("nombre") < 0) throw new Error(`${basename(path)}: no tiene la columna "Nombre de la tarea"`);
  const modulo = moduloDeArchivo(path);
  return rows
    .slice(1)
    .filter((r) => get(r, "nombre"))
    .map((r) => {
      const creacion = fecha(get(r, "creacion"));
      const venc = fecha(get(r, "vencimiento"));
      let inicio = fecha(get(r, "inicio"));
      if (!inicio && creacion && venc) inicio = creacion <= venc ? creacion : venc;
      const estado = ESTADO[get(r, "estado").toLowerCase()] ?? "Por Hacer";
      const etiquetas = [get(r, "etiquetas"), get(r, "deposito")].filter(Boolean).join(";");
      return {
        modulo,
        fila: {
          Proyecto: "TAXATION SMART",
          "Requerimiento/Tarea": get(r, "nombre").replace(/\s+/g, " "),
          Modulo_Taxation: modulo,
          Estado: estado,
          Prioridad: PRIORIDAD[get(r, "prioridad").toLowerCase()] ?? "Media",
          Responsable: get(r, "asignado").replace(/;\s*/g, ", "),
          Fecha_Inicio: inicio,
          Fecha_Entrega: venc,
          Bloqueado: "No",
          Detalle_Bloqueo: "",
          Fecha_Creacion: creacion || hoy,
          Descripcion: get(r, "notas").replace(/\r\n/g, "\n"),
          Fecha_Finalizacion: estado === "Completado" ? fecha(get(r, "finalizacion")) : "",
          Checklist: get(r, "checkItems"),
          Checklist_Progreso: get(r, "checkHechos"),
          Etiquetas: etiquetas,
          Origen: `Planner · ${basename(path)}`,
        },
      };
    });
}

// ── Google Sheets ─────────────────────────────────────────────────────────
const TAREAS = "Proyectos_Tareas";
const CONFIG = "Configuracion";
const HEADERS_TAREAS = [
  "ID", "Proyecto", "Requerimiento/Tarea", "Modulo_Taxation", "Estado", "Prioridad", "Responsable", "Fecha_Inicio",
  "Fecha_Entrega", "Bloqueado", "Detalle_Bloqueo", "Fecha_Creacion", "Descripcion", "Fecha_Finalizacion",
  "Checklist", "Checklist_Progreso", "Etiquetas", "Origen",
];
const HEADERS_CONFIG = ["ID", "Tipo", "Valor", "Descripcion", "Orden", "Estado"];
const a1 = (s, r) => `'${s}'!${r}`;
const colLetter = (n) => { let s = ""; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const sanitize = (v) => { const s = v == null ? "" : String(v); return /^[=+\-@]/.test(s) ? `'${s}` : s; };

async function asegurarEncabezados(sheets, spreadsheetId, sheet, esperados) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(sheet, "1:1") });
  const actuales = (r.data.values?.[0] ?? []).map((h) => String(h).trim());
  const faltan = esperados.filter((h) => !actuales.includes(h));
  if (faltan.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: a1(sheet, `${colLetter(actuales.length)}1`),
      valueInputOption: "RAW",
      requestBody: { values: [faltan] },
    });
    console.log(`  Columnas agregadas en ${sheet}: ${faltan.join(", ")}`);
  }
  return [...actuales, ...faltan];
}

// ── Main ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const paths = args.filter((a) => a !== "--dry-run");
if (!paths.length) {
  console.error('Uso: npm run import-planner -- [--dry-run] "archivo1.xlsx" "archivo2.csv" ...');
  process.exit(1);
}

const hoy = new Date().toISOString().slice(0, 10);
const nuevas = [];
for (const p of paths) {
  const rows = extname(p).toLowerCase() === ".csv" ? readCsv(p) : readXlsx(p);
  const mapeadas = mapear(p, rows, hoy);
  console.log(`${basename(p)} → módulo "${moduloDeArchivo(p)}": ${mapeadas.length} tareas`);
  nuevas.push(...mapeadas);
}

const { GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId, GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: key } = process.env;
if (!spreadsheetId || !email || !key) {
  console.error("Faltan variables GOOGLE_* en .env.local");
  process.exit(1);
}
const auth = new google.auth.JWT({ email, key: key.replace(/\\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });

// Tareas existentes (para no duplicar y para generar IDs únicos)
const existentes = (await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(TAREAS, "A:Z") })).data.values ?? [];
const hdr = (existentes[0] ?? []).map((h) => String(h).trim());
const iId = hdr.indexOf("ID"), iNom = hdr.indexOf("Requerimiento/Tarea"), iMod = hdr.indexOf("Modulo_Taxation"), iEnt = hdr.indexOf("Fecha_Entrega");
// Una tarea es la misma si coinciden módulo, nombre y fecha de entrega (Planner repite nombres en tareas periódicas)
const clave = (mod, nom, ent) =>
  [mod, String(nom).replace(/\s+/g, " "), fecha(ent)].map((x) => String(x ?? "").trim().toLowerCase()).join("|");
const yaEstan = new Set(existentes.slice(1).map((r) => clave(r[iMod] ?? "", r[iNom] ?? "", r[iEnt] ?? "")));
const ids = new Set(existentes.slice(1).map((r) => r[iId]));

// Reusa el nombre de módulo ya existente si solo cambia en tildes, mayúsculas o plurales
// ("Agentes IA.xlsx" → módulo "Agente IA" si ese ya está configurado).
const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/s$/, "")).join(" ");
let cfgPrev = [];
try {
  cfgPrev = ((await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(CONFIG, "A:F") })).data.values ?? []).slice(1).filter((r) => r[1] === "modulo").map((r) => r[2]);
} catch { /* la pestaña aún no existe */ }
const canonicos = [...new Set([...cfgPrev, ...existentes.slice(1).map((r) => r[iMod])].map((m) => String(m ?? "").trim()).filter(Boolean))];
const avisados = new Set();
for (const n of nuevas) {
  const igual = canonicos.find((m) => norm(m) === norm(n.modulo));
  if (igual && igual !== n.modulo) {
    if (!avisados.has(n.modulo)) console.log(`  Módulo "${n.modulo}" → se usa el existente "${igual}"`);
    avisados.add(n.modulo);
    n.modulo = igual;
    n.fila.Modulo_Taxation = igual;
  }
}

const aInsertar = [];
const omitidas = [];
const seq = {};
for (const n of nuevas) {
  const k = clave(n.modulo, n.fila["Requerimiento/Tarea"], n.fila.Fecha_Entrega);
  if (yaEstan.has(k)) { omitidas.push(n.fila["Requerimiento/Tarea"]); continue; }
  yaEstan.add(k);
  const code = codigoModulo(n.modulo);
  let id;
  do { seq[code] = (seq[code] ?? 0) + 1; id = `T-${code}-${String(seq[code]).padStart(3, "0")}`; } while (ids.has(id));
  ids.add(id);
  aInsertar.push({ ID: id, ...n.fila });
}

const resumen = {};
for (const t of aInsertar) {
  const r = (resumen[t.Modulo_Taxation] ??= { total: 0 });
  r.total++;
  r[t.Estado] = (r[t.Estado] ?? 0) + 1;
}
console.log("\nA importar:", aInsertar.length, "· Omitidas por duplicado:", omitidas.length);
console.table(resumen);

if (!aInsertar.length) {
  console.log("\nNo hay tareas nuevas para importar.");
  process.exit(0);
}
if (dryRun) {
  console.log("\n(--dry-run) No se escribió nada. Ejemplo:", JSON.stringify({ ...aInsertar[0], Descripcion: aInsertar[0]?.Descripcion?.slice(0, 80) + "…" }, null, 2));
  process.exit(0);
}

const headers = await asegurarEncabezados(sheets, spreadsheetId, TAREAS, HEADERS_TAREAS);
for (let i = 0; i < aInsertar.length; i += 200) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: a1(TAREAS, "A1"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: aInsertar.slice(i, i + 200).map((t) => headers.map((h) => sanitize(t[h]))) },
  });
}
console.log(`✔ ${aInsertar.length} tareas agregadas a ${TAREAS}`);

// Registrar los módulos en la pestaña Configuracion
const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
if (!meta.data.sheets.some((s) => s.properties.title === CONFIG)) {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: CONFIG } } }] } });
}
const cHeaders = await asegurarEncabezados(sheets, spreadsheetId, CONFIG, HEADERS_CONFIG);
const cfg = ((await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(CONFIG, "A:Z") })).data.values ?? []).slice(1);
const ci = (h) => cHeaders.indexOf(h);
const modulosCfg = cfg.filter((r) => r[ci("Tipo")] === "modulo");
const tieneModulos = new Set(modulosCfg.map((r) => String(r[ci("Valor")]).trim().toLowerCase()));
let orden = modulosCfg.reduce((m, r) => Math.max(m, Number(r[ci("Orden")]) || 0), 0);
// Si el catálogo estaba vacío, conserva también los módulos que ya usaban las tareas existentes
const usados = [...new Set([...existentes.slice(1).map((r) => r[iMod]), ...aInsertar.map((t) => t.Modulo_Taxation)].map((m) => String(m ?? "").trim()).filter(Boolean))];
const candidatos = modulosCfg.length ? [...new Set(aInsertar.map((t) => t.Modulo_Taxation))] : usados;
const nuevosMods = candidatos.filter((m) => !tieneModulos.has(m.toLowerCase()));
if (nuevosMods.length) {
  const filas = nuevosMods.map((m) => {
    const item = { ID: `C-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`, Tipo: "modulo", Valor: m, Descripcion: "", Orden: String(++orden), Estado: "Activo" };
    return cHeaders.map((h) => sanitize(item[h]));
  });
  await sheets.spreadsheets.values.append({ spreadsheetId, range: a1(CONFIG, "A1"), valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: filas } });
  console.log(`✔ Módulos agregados a Configuracion: ${nuevosMods.join(", ")}`);
}
console.log("Listo ✔");
