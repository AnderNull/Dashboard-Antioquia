// Crea las pestañas faltantes, escribe los encabezados y (opcional) registra un Admin inicial.
// Uso: npm run init-sheets
//      npm run init-sheets -- admin@empresa.com "Nombre Admin" "ContraseñaSegura"
import { google } from "googleapis";
import bcrypt from "bcryptjs";

const HEADERS = {
  Usuarios_Autorizados: ["ID", "Nombre", "Email", "PasswordHash", "Rol", "Estado"],
  Proyectos_Tareas: ["ID", "Proyecto", "Requerimiento/Tarea", "Modulo_Taxation", "Estado", "Prioridad", "Responsable", "Fecha_Inicio", "Fecha_Entrega", "Bloqueado", "Detalle_Bloqueo", "Fecha_Creacion"],
  Levantamientos: ["ID", "Codigo_Requerimiento", "Descripcion_Gobernacion", "Modulo_Afectado", "Impacto_Tributario", "Estado_Aprobacion", "Fecha_Levantamiento"],
  Bloqueos_Log: ["ID", "Tarea_ID", "Tipo_Bloqueo", "Descripcion_Bloqueo", "Fecha_Registro", "Fecha_Resolucion", "Estado"],
};

const { GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId, GOOGLE_SERVICE_ACCOUNT_EMAIL: email, GOOGLE_PRIVATE_KEY: key } = process.env;
if (!spreadsheetId || !email || !key) {
  console.error("Faltan variables GOOGLE_* en .env.local");
  process.exit(1);
}
const auth = new google.auth.JWT({ email, key: key.replace(/\n/g, "\n"), scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
const sheets = google.sheets({ version: "v4", auth });
const a1 = (s, r) => `'${s}'!${r}`;

const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
const existing = new Set(meta.data.sheets.map((s) => s.properties.title));
const missing = Object.keys(HEADERS).filter((s) => !existing.has(s));
if (missing.length) {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) } });
  console.log("Pestañas creadas:", missing.join(", "));
}
for (const [sheet, headers] of Object.entries(HEADERS)) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId, range: a1(sheet, "1:1") });
  if (!r.data.values?.[0]?.length) {
    await sheets.spreadsheets.values.update({ spreadsheetId, range: a1(sheet, "A1"), valueInputOption: "RAW", requestBody: { values: [headers] } });
    console.log(`Encabezados escritos en ${sheet}`);
  }
}

const [adminEmail, adminName, adminPwd] = process.argv.slice(2);
if (adminEmail && adminPwd) {
  const users = await sheets.spreadsheets.values.get({ spreadsheetId, range: a1("Usuarios_Autorizados", "C:C") });
  const exists = (users.data.values ?? []).flat().some((e) => String(e).toLowerCase() === adminEmail.toLowerCase());
  if (exists) {
    console.log(`El usuario ${adminEmail} ya existe; no se modificó.`);
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId, range: a1("Usuarios_Autorizados", "A1"), valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [["U-001", adminName || "Administrador", adminEmail, bcrypt.hashSync(adminPwd, 12), "Admin", "Activo"]] },
    });
    console.log(`Admin ${adminEmail} creado.`);
  }
}
console.log("Listo ✔");
