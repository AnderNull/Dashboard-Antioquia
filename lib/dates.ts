// Fechas como "número de día" UTC: evita errores por zona horaria al comparar fechas sin hora.

export const DAY_MS = 86_400_000;

/** Convierte "aaaa-mm-dd" o "dd/mm/aaaa" a número de día; null si está vacía o no es válida. */
export function toDay(s?: string): number | null {
  const v = (s ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]) / DAY_MS;
  return null;
}

export const dateOf = (d: number) => new Date(d * DAY_MS);

export const fmtDay = (d: number, o: Intl.DateTimeFormatOptions) =>
  dateOf(d).toLocaleDateString("es-CO", { timeZone: "UTC", ...o });

/** Día de hoy según el reloj local del navegador. */
export function localToday(): number {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS;
}
