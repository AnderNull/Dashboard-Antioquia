import { SheetsConfigError } from "./googleSheets";

/** Ejecuta una carga de datos y convierte los errores en un mensaje legible. */
export async function safeLoad<T>(fn: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    return { data: await fn(), error: null };
  } catch (e) {
    console.error(e);
    const msg =
      e instanceof SheetsConfigError
        ? e.message
        : "Revisa que la Service Account tenga acceso de edición al Spreadsheet y que existan las pestañas requeridas.";
    return { data: null, error: msg };
  }
}
