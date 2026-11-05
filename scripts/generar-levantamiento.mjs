// Llena la plantilla oficial "Formato Levantamiento de Cliente" (IT-CP-F-06) sin alterar su formato.
//
// Uso:
//   npm run generar-levantamiento -- datos.json [--out "C:\carpeta\salida"]
//
// datos.json (todos los campos son texto; los de contenido aceptan un texto o una lista de párrafos):
// {
//   "numero": "2391",                       // # REQUERIMIENTO (se completa a 7 dígitos: 0002391)
//   "fecha": "2026-11-05",                  // FECHA SOLICITUD (AAAA-MM-DD o DD/MM/AAAA)
//   "clasificacion": "MEJORA",              // CAMBIO | MEJORA | DEFECTO (marca la casilla con X)
//   "modulo": "Facilidades de Pago",        // MÓDULO
//   "cliente": "GOBERNACIÓN ANTIOQUIA",     // opcionales: por defecto se conservan los de la plantilla
//   "proyecto": "GENESYS", "producto": "SMART",
//   "objetivo": "...", "alcance": ["...", "..."], "ajuste": "...", "resultado": "...",
//   "analisis": "...",                      // opcional: ANÁLISIS DE SOLICITUD REQUERIMIENTO
//   "aprobado_por": "", "representante": "", "fecha_aprobacion": "", "fecha_entrega": "",   // opcionales
//   "titulo": "..."                         // opcional: solo para el nombre del archivo
// }
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzip, zip, escXml } from "./lib/docx.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLANTILLA = resolve(AQUI, "..", "plantillas", "Formato_levantamiento.docx");

// ── Argumentos ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const iOut = args.indexOf("--out");
const outDir = iOut >= 0 ? args[iOut + 1] : resolve(AQUI, "..", "levantamientos-generados");
const jsonPath = args.find((a, i) => !a.startsWith("--") && i !== iOut + 1);
if (!jsonPath) {
  console.error('Uso: npm run generar-levantamiento -- datos.json [--out "carpeta"]');
  process.exit(1);
}
const d = JSON.parse(readFileSync(jsonPath, "utf8"));

const parrafos = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(/\r?\n/))
    .map((s) => String(s).trim())
    .filter(Boolean);
function fechaDMA(v) {
  const s = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  return s;
}
const numero = /^\d+$/.test(String(d.numero ?? "").trim()) ? String(d.numero).trim().padStart(7, "0") : String(d.numero ?? "").trim();
const clasificacion = String(d.clasificacion ?? "").trim().toUpperCase();
if (clasificacion && !["CAMBIO", "MEJORA", "DEFECTO"].includes(clasificacion)) {
  console.error('"clasificacion" debe ser CAMBIO, MEJORA o DEFECTO');
  process.exit(1);
}

// ── Utilidades XML ────────────────────────────────────────────────────────
const PARRAFO = /<w:p\b(?:(?!<w:p\b).)*?<\/w:p>/gs; // párrafos sin anidar (los de cuadros de texto quedan dentro de su propio <w:p>)
const runsDe = (rPr) => (texto) => `<w:r>${rPr}<w:t xml:space="preserve">${escXml(texto)}</w:t></w:r>`;
/** rPr de la marca de párrafo, convertido en rPr de texto (sin negrita para el contenido si se pide). */
function rPrDe(p, { sinNegrita = false } = {}) {
  const ppr = /<w:pPr>.*?<\/w:pPr>/s.exec(p)?.[0] ?? "";
  let r = /<w:rPr>.*?<\/w:rPr>/s.exec(ppr)?.[0] ?? "";
  if (sinNegrita) r = r.replace(/<w:b\/>|<w:bCs\/>/g, "");
  return r;
}
/** Reemplaza todo el texto visible de un párrafo conservando el formato del primer run. */
function fijarTexto(p, texto) {
  let primero = true;
  return p.replace(/(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)/g, (_, a, __, c) => {
    if (primero) {
      primero = false;
      return `<w:t xml:space="preserve">${escXml(texto)}${c}`;
    }
    return `${a}${c}`;
  });
}
/** Llena un párrafo vacío con uno o varios párrafos que heredan su formato. */
function llenarVacio(p, lineas, opts) {
  if (!lineas.length) return p;
  const run = runsDe(rPrDe(p, opts));
  return lineas.map((l) => p.replace(/<\/w:p>$/, `${run(l)}</w:p>`)).join("");
}
const tablas = (xml) => [...xml.matchAll(/<w:tbl>.*?<\/w:tbl>/gs)];
const celdas = (fila) => [...fila.matchAll(/<w:tc>.*?<\/w:tc>/gs)].map((m) => m[0]);
const filas = (tabla) => [...tabla.matchAll(/<w:tr\b.*?<\/w:tr>/gs)].map((m) => m[0]);
const textoDe = (s) => [...s.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

function editarTabla(xml, idx, fn) {
  const t = tablas(xml)[idx];
  if (!t) throw new Error(`La plantilla no tiene la tabla #${idx + 1}`);
  return xml.slice(0, t.index) + fn(t[0]) + xml.slice(t.index + t[0].length);
}
function editarCelda(tabla, fila, col, fn) {
  const fs = filas(tabla);
  const cs = celdas(fs[fila]);
  const nueva = fn(cs[col]);
  const filaNueva = fs[fila].replace(cs[col], () => nueva);
  return tabla.replace(fs[fila], () => filaNueva);
}
/** Reemplaza el texto del párrafo de una celda que contiene `buscado`. */
const reemplazarEnCelda = (celda, buscado, nuevo) =>
  celda.replace(PARRAFO, (p) => (textoDe(p).trim() === buscado ? fijarTexto(p, nuevo) : p));
/** Primer párrafo vacío (sin texto ni dibujos) de una celda. */
function llenarPrimerVacio(celda, lineas, opts) {
  let hecho = false;
  return celda.replace(PARRAFO, (p) => {
    if (hecho || textoDe(p).trim() || p.includes("<w:drawing")) return p;
    hecho = true;
    return llenarVacio(p, lineas, opts);
  });
}

// ── Cargar plantilla ──────────────────────────────────────────────────────
const files = unzip(readFileSync(PLANTILLA));
let xml = files["word/document.xml"].toString("utf8");

// Tabla 1: # REQUERIMIENTO · FECHA SOLICITUD
xml = editarTabla(xml, 0, (t) => {
  if (numero) t = editarCelda(t, 1, 0, (c) => c.replace(PARRAFO, (p) => (textoDe(p).trim() ? fijarTexto(p, numero) : p)));
  if (d.fecha) t = editarCelda(t, 1, 1, (c) => c.replace(PARRAFO, (p) => (textoDe(p).trim() ? fijarTexto(p, fechaDMA(d.fecha)) : p)));
  return t;
});

// Tabla 2: CLASIFICACIÓN → X dentro del recuadro junto a la opción elegida
if (clasificacion) {
  xml = editarTabla(xml, 1, (t) => {
    const formas = [...t.matchAll(/<mc:AlternateContent>.*?<\/mc:AlternateContent>/gs)].map((m) => {
      const c = m[0];
      return {
        xml: c,
        x: Number(/<wp:positionH[^>]*><wp:posOffset>(-?\d+)/.exec(c)?.[1] ?? 0),
        texto: textoDe(/<mc:Choice.*?<\/mc:Choice>/s.exec(c)?.[0] ?? ""),
        recuadro: /prst="rect"/.test(c) && !/txBox="1"/.test(c),
      };
    });
    const etiqueta = formas.find((f) => f.texto.trim() === clasificacion);
    // El recuadro es el que queda inmediatamente a la izquierda de la etiqueta
    const recuadro = formas.filter((f) => f.recuadro && f.x < etiqueta.x).sort((a, b) => b.x - a.x)[0];
    if (!etiqueta || !recuadro) throw new Error("No se encontró la casilla de clasificación en la plantilla");
    const marca =
      '<w:txbxContent><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>' +
      '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="000000"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t>X</w:t></w:r></w:p></w:txbxContent>';
    const marcado = recuadro.xml
      .replace(/<wps:bodyPr\b([^>]*?)\slIns="\d+" tIns="\d+" rIns="\d+" bIns="\d+"/, '<wps:txbx>' + marca + '</wps:txbx><wps:bodyPr$1 lIns="0" tIns="0" rIns="0" bIns="0"')
      .replace(/<v:rect\b([^>]*?)\/>/s, `<v:rect$1><v:textbox inset="0,0,0,0">${marca}</v:textbox></v:rect>`);
    return t.replace(recuadro.xml, () => marcado);
  });
}

// Tabla 3: CLIENTE · PROYECTO · PRODUCTO · MÓDULO
xml = editarTabla(xml, 2, (t) => {
  const vals = [d.cliente, d.proyecto, d.producto, d.modulo];
  vals.forEach((v, col) => {
    if (!v) return;
    t = editarCelda(t, 1, col, (c) => c.replace(PARRAFO, (p) => (textoDe(p).trim() ? fijarTexto(p, String(v).trim()) : p)));
  });
  return t;
});

// Tabla 4: REQUERIMIENTO → contenido bajo cada subtítulo numerado
xml = editarTabla(xml, 3, (t) =>
  editarCelda(t, 1, 0, (c) => {
    const secciones = { Objetivo: d.objetivo, "Alcance Funcional": d.alcance, "Ajuste Requerido": d.ajuste, "Resultado Esperado": d.resultado };
    const ps = [...c.matchAll(PARRAFO)].map((m) => m[0]);
    let out = c;
    ps.forEach((p, i) => {
      const titulo = textoDe(p).trim();
      if (!(titulo in secciones)) return;
      const vacio = ps[i + 1];
      if (vacio === undefined || textoDe(vacio).trim()) return;
      out = out.replace(vacio, () => llenarVacio(vacio, parrafos(secciones[titulo]), { sinNegrita: true }));
    });
    return out;
  }),
);

// Tabla 5: ANÁLISIS · APROBACIONES
xml = editarTabla(xml, 4, (t) => {
  if (d.analisis) t = editarCelda(t, 1, 0, (c) => llenarPrimerVacio(c, parrafos(d.analisis), { sinNegrita: true }));
  const pares = [
    [2, 1, d.aprobado_por],
    [2, 3, d.representante],
    [3, 1, d.fecha_aprobacion && fechaDMA(d.fecha_aprobacion)],
    [3, 3, d.fecha_entrega && fechaDMA(d.fecha_entrega)],
  ];
  for (const [f, col, v] of pares) if (v) t = editarCelda(t, f, col, (c) => llenarPrimerVacio(c, [String(v)], { sinNegrita: true }));
  return t;
});

files["word/document.xml"] = Buffer.from(xml, "utf8");

// ── Guardar ───────────────────────────────────────────────────────────────
const limpio = (s) => String(s ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const nombre = `Levantamiento REQ ${numero || "SIN-NUMERO"}${d.titulo ? " - " + limpio(d.titulo) : ""}.docx`;
mkdirSync(outDir, { recursive: true });
const destino = join(outDir, nombre);
writeFileSync(destino, zip(files));
console.log(`✔ Formato generado: ${destino}`);
