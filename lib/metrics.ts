// Clasificación de tareas respecto al día de hoy y agregados por responsable.
import { toDay } from "./dates";
import type { Tarea } from "./types";

export type Situacion =
  | "vencida" // la entrega ya pasó y no está completada
  | "en_ejecucion" // está en progreso o en revisión
  | "sin_iniciar" // su ventana ya empezó pero sigue en "Por Hacer"
  | "programada" // inicia en el futuro
  | "sin_fechas"
  | "completada";

export interface TareaCtx {
  t: Tarea;
  s: number | null;
  e: number | null;
  situacion: Situacion;
  bloqueada: boolean;
  /** true si hoy está dentro de [inicio, entrega] */
  enVentana: boolean;
  diasRestantes: number | null;
  /** % del plazo ya consumido (0–100) */
  avanceTiempo: number | null;
}

const EN_CURSO = new Set(["En Progreso", "En Revisión"]);

export function clasificar(t: Tarea, today: number): TareaCtx {
  const s0 = toDay(t.Fecha_Inicio);
  const e0 = toDay(t.Fecha_Entrega);
  let s = s0 ?? e0;
  let e = e0 ?? s0;
  if (s !== null && e !== null && e < s) [s, e] = [e, s];

  const enCurso = EN_CURSO.has(t.Estado);
  let situacion: Situacion;
  if (t.Estado === "Completado") situacion = "completada";
  else if (s === null || e === null) situacion = enCurso ? "en_ejecucion" : "sin_fechas";
  else if (e < today) situacion = "vencida";
  else if (enCurso) situacion = "en_ejecucion";
  else if (s > today) situacion = "programada";
  else situacion = "sin_iniciar";

  const fechas = s !== null && e !== null;
  return {
    t,
    s,
    e,
    situacion,
    bloqueada: t.Bloqueado === "Sí" && t.Estado !== "Completado",
    enVentana: fechas && s! <= today && today <= e! && t.Estado !== "Completado",
    diasRestantes: e !== null ? e - today : null,
    avanceTiempo: fechas ? Math.max(0, Math.min(100, Math.round(((today - s! + 1) / (e! - s! + 1)) * 100))) : null,
  };
}

/** Separa responsables múltiples: "Ana, Juan / Pedro" → ["Ana","Juan","Pedro"]. */
export function responsables(t: Tarea): string[] {
  const r = (t.Responsable ?? "")
    .split(/[,;/]|\s+y\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return r.length ? r : ["Sin asignar"];
}

export interface FilaUsuario {
  responsable: string;
  total: number;
  pendientes: number;
  enEjecucion: number;
  sinIniciar: number;
  programadas: number;
  vencidas: number;
  sinFechas: number;
  bloqueadas: number;
  completadas: number;
  enVentanaHoy: number;
  cumplimiento: number;
}

export function porUsuario(ctx: TareaCtx[]): FilaUsuario[] {
  const map = new Map<string, FilaUsuario>();
  for (const c of ctx) {
    for (const r of responsables(c.t)) {
      const f =
        map.get(r) ??
        ({
          responsable: r,
          total: 0,
          pendientes: 0,
          enEjecucion: 0,
          sinIniciar: 0,
          programadas: 0,
          vencidas: 0,
          sinFechas: 0,
          bloqueadas: 0,
          completadas: 0,
          enVentanaHoy: 0,
          cumplimiento: 0,
        } as FilaUsuario);
      f.total++;
      if (c.situacion !== "completada") f.pendientes++;
      if (c.situacion === "en_ejecucion") f.enEjecucion++;
      if (c.situacion === "sin_iniciar") f.sinIniciar++;
      if (c.situacion === "programada") f.programadas++;
      if (c.situacion === "vencida") f.vencidas++;
      if (c.situacion === "sin_fechas") f.sinFechas++;
      if (c.situacion === "completada") f.completadas++;
      if (c.bloqueada) f.bloqueadas++;
      if (c.enVentana) f.enVentanaHoy++;
      map.set(r, f);
    }
  }
  return [...map.values()]
    .map((f) => ({ ...f, cumplimiento: f.total ? Math.round((f.completadas / f.total) * 100) : 0 }))
    .sort((a, b) => b.pendientes - a.pendientes || a.responsable.localeCompare(b.responsable, "es"));
}
