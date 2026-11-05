// Lectura de archivos tabulares sin dependencias externas: .xlsx (zip + XML) y .csv.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { inflateRawSync } from "node:zlib";

// ── Lectura de .xlsx sin dependencias (zip + XML) ──────────────────────────
export function unzip(buf) {
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

export function readXlsx(path) {
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

export function readCsv(path) {
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

/** Lee la primera hoja de un .xlsx o un .csv y devuelve las filas como arreglos de texto. */
export function readTabular(path) {
  return extname(path).toLowerCase() === ".csv" ? readCsv(path) : readXlsx(path);
}
