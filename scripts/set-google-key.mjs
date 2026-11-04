// Copia client_email y private_key del JSON de la Service Account a .env.local
// sin imprimir la clave en pantalla.
// Uso: npm run set-google-key -- "C:\ruta\al\archivo.json"
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const jsonPath = process.argv[2];
if (!jsonPath || !existsSync(jsonPath)) {
  console.error('Uso: npm run set-google-key -- "C:\\ruta\\al\\archivo.json"');
  process.exit(1);
}

let creds;
try {
  creds = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch {
  console.error("El archivo no es un JSON válido.");
  process.exit(1);
}
if (creds.type !== "service_account" || !creds.private_key || !creds.client_email) {
  console.error("El JSON no parece una clave de Service Account (faltan type/private_key/client_email).");
  process.exit(1);
}

const envPath = ".env.local";
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
// Clave en una sola línea, con \n literales y entre comillas dobles
const keyLine = `GOOGLE_PRIVATE_KEY="${creds.private_key.replace(/\r?\n/g, "\\n")}"`;
const emailLine = `GOOGLE_SERVICE_ACCOUNT_EMAIL=${creds.client_email}`;

const setVar = (text, name, line) => {
  const re = new RegExp(`^${name}=.*$`, "m");
  return re.test(text) ? text.replace(re, () => line) : `${text.trimEnd()}\n${line}\n`;
};

let out = setVar(env, "GOOGLE_SERVICE_ACCOUNT_EMAIL", emailLine);
out = setVar(out, "GOOGLE_PRIVATE_KEY", keyLine);
writeFileSync(envPath, out);

console.log(`✔ .env.local actualizado`);
console.log(`  GOOGLE_SERVICE_ACCOUNT_EMAIL = ${creds.client_email}`);
console.log(`  GOOGLE_PRIVATE_KEY = (oculta, ${creds.private_key.length} caracteres)`);
console.log(`  Proyecto de Google Cloud: ${creds.project_id}`);
