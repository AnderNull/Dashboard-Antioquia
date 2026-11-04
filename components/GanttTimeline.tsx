"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CalendarClock, ChevronDown, ChevronRight, Crosshair, Lock } from "lucide-react";
import type { EstadoTarea, Tarea } from "@/lib/types";
import { DAY_MS, dateOf, fmtDay, localToday, toDay } from "@/lib/dates";

/* ───────────────────────── Fechas (índice de día UTC, sin zonas horarias) ───────────────────────── */

const ROW = 40; // alto de fila en px
const HEADER = 56; // alto del encabezado de dos niveles

const fmt = fmtDay;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dow = (d: number) => (d + 4) % 7; // 0 = domingo (el 1-ene-1970 fue jueves)
const monday = (d: number) => d - ((dow(d) + 6) % 7);
const monthKey = (d: number) => `${dateOf(d).getUTCFullYear()}-${dateOf(d).getUTCMonth()}`;

type Seg = { k: string; label: string; from: number; len: number };
function segments(start: number, days: number, key: (d: number) => string, label: (d: number) => string): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < days; i++) {
    const d = start + i;
    const k = key(d);
    const last = out[out.length - 1];
    if (last && last.k === k) last.len++;
    else out.push({ k, label: label(d), from: i, len: 1 });
  }
  return out;
}

/* ───────────────────────── Escalas y estilos ───────────────────────── */

type Zoom = "dia" | "semana" | "mes";
const ZOOMS: { id: Zoom; label: string; px: number; pad: number; minDays: number }[] = [
  { id: "dia", label: "Días", px: 34, pad: 3, minDays: 45 },
  { id: "semana", label: "Semanas", px: 12, pad: 7, minDays: 140 },
  { id: "mes", label: "Meses", px: 4, pad: 15, minDays: 400 },
];

const ESTADO: Record<EstadoTarea, { track: string; fill: string; dot: string }> = {
  "Por Hacer": { track: "bg-slate-400/25 ring-slate-400/60", fill: "bg-slate-500/80", dot: "bg-slate-400" },
  "En Progreso": { track: "bg-sky-400/25 ring-sky-500/60", fill: "bg-sky-500", dot: "bg-sky-500" },
  "En Revisión": { track: "bg-violet-400/25 ring-violet-500/60", fill: "bg-violet-500", dot: "bg-violet-500" },
  Completado: { track: "bg-emerald-400/25 ring-emerald-600/60", fill: "bg-brand-600", dot: "bg-brand-600" },
};
const AVANCE: Record<string, number> = { "Por Hacer": 0, "En Progreso": 50, "En Revisión": 80, Completado: 100 };
const STRIPES = "repeating-linear-gradient(45deg, rgb(220 38 38 / 0.38) 0 5px, transparent 5px 10px)";

type Item = { t: Tarea; s: number; e: number; hito: boolean; pct: number };
type Grupo = { modulo: string; items: Item[]; s: number; e: number; pct: number };
type Fila =
  | { kind: "grupo"; g: Grupo }
  | { kind: "tarea"; it: Item }
  | { kind: "sinTitulo"; n: number }
  | { kind: "sin"; t: Tarea };

/* ───────────────────────── Componente ───────────────────────── */

export default function GanttTimeline({ tareas, onSelect }: { tareas: Tarea[]; onSelect: (t: Tarea) => void }) {
  const [zoom, setZoom] = useState<Zoom>("semana");
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const leftCol = useRef<HTMLDivElement>(null);
  const today = useMemo(localToday, []);
  const z = ZOOMS.find((x) => x.id === zoom)!;

  // Agrupa por módulo (como las tareas resumen de MS Project)
  const { grupos, sinFechas, min, max } = useMemo(() => {
    const porModulo = new Map<string, Item[]>();
    const sin: Tarea[] = [];
    for (const t of tareas) {
      let s = toDay(t.Fecha_Inicio);
      let e = toDay(t.Fecha_Entrega);
      if (s === null && e === null) {
        sin.push(t);
        continue;
      }
      const hito = s === null || e === null;
      s ??= e!;
      e ??= s;
      if (e < s) [s, e] = [e, s];
      const m = t.Modulo_Taxation || "Sin módulo";
      porModulo.set(m, [...(porModulo.get(m) ?? []), { t, s, e, hito, pct: AVANCE[t.Estado] ?? 0 }]);
    }
    const grupos: Grupo[] = [...porModulo.entries()]
      .map(([modulo, items]) => {
        items.sort((a, b) => a.s - b.s || a.e - b.e);
        return {
          modulo,
          items,
          s: Math.min(...items.map((i) => i.s)),
          e: Math.max(...items.map((i) => i.e)),
          pct: Math.round(items.reduce((a, i) => a + i.pct, 0) / items.length),
        };
      })
      .sort((a, b) => a.s - b.s);
    const all = grupos.flatMap((g) => [g.s, g.e]);
    return {
      grupos,
      sinFechas: sin,
      min: Math.min(today, ...all),
      max: Math.max(today, ...all),
    };
  }, [tareas, today]);

  // Rango visible alineado a la escala
  let start = min - z.pad;
  if (zoom !== "dia") start = monday(start);
  if (zoom === "mes") {
    const d = dateOf(start);
    start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY_MS;
  }
  const days = Math.max(max + z.pad - start + 1, z.minDays);
  const px = z.px;
  const width = days * px + 140; // espacio extra para la etiqueta del responsable

  const top = segments(
    start,
    days,
    zoom === "mes" ? (d) => String(dateOf(d).getUTCFullYear()) : monthKey,
    zoom === "mes" ? (d) => String(dateOf(d).getUTCFullYear()) : (d) => cap(fmt(d, { month: "long", year: "numeric" })),
  );
  const bottom =
    zoom === "dia"
      ? segments(start, days, String, (d) => String(dateOf(d).getUTCDate()))
      : zoom === "semana"
        ? segments(start, days, (d) => String(monday(d)), (d) => fmt(monday(d), { day: "2-digit", month: "short" }))
        : segments(start, days, monthKey, (d) => cap(fmt(d, { month: "short" }).replace(".", "")));

  const filas: Fila[] = [];
  for (const g of grupos) {
    filas.push({ kind: "grupo", g });
    if (!cerrados.has(g.modulo)) for (const it of g.items) filas.push({ kind: "tarea", it });
  }
  if (sinFechas.length) {
    filas.push({ kind: "sinTitulo", n: sinFechas.length });
    for (const t of sinFechas) filas.push({ kind: "sin", t });
  }

  const x = (d: number) => (d - start) * px;
  const toggle = (m: string) =>
    setCerrados((prev) => {
      const n = new Set(prev);
      if (n.has(m)) n.delete(m);
      else n.add(m);
      return n;
    });

  function irAHoy(smooth = true) {
    const el = scroller.current;
    if (!el) return;
    const left = (leftCol.current?.offsetWidth ?? 0) + x(today) - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
  }
  // Al abrir o cambiar de escala, muestra desde el inicio del proyecto
  useEffect(() => {
    scroller.current?.scrollTo({ left: 0 });
  }, [zoom]);

  const fechaCorta = (d: number) => fmt(d, { day: "2-digit", month: "2-digit", year: "2-digit" });
  const vencida = (it: Item) => it.t.Estado !== "Completado" && it.e < today;

  return (
    <section className="card overflow-hidden">
      {/* Barra de herramientas */}
      <header className="flex flex-col gap-3 border-b border-white/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-ink-900">
            <CalendarClock className="h-4 w-4 text-series-1" /> Línea de tiempo del proyecto
          </h3>
          <p className="text-xs text-slate-500">
            {tareas.length} actividades · agrupadas por módulo · clic en una barra para editarla
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/60 bg-white/30 p-1 backdrop-blur-xl" role="group" aria-label="Escala de tiempo">
            {ZOOMS.map((o) => (
              <button
                key={o.id}
                onClick={() => setZoom(o.id)}
                aria-pressed={zoom === o.id}
                className={clsx(
                  "rounded-lg px-3 py-1 text-xs font-medium transition",
                  zoom === o.id ? "bg-white/85 text-ink-900 shadow-sm" : "text-slate-600 hover:bg-white/50",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button onClick={() => irAHoy()} className="btn-ghost px-3 py-1.5 text-xs">
            <Crosshair className="h-3.5 w-3.5" /> Hoy
          </button>
        </div>
      </header>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/60 px-4 py-2 text-[11px] text-slate-600">
        {(Object.keys(ESTADO) as EstadoTarea[]).map((e) => (
          <span key={e} className="flex items-center gap-1.5">
            <span className={clsx("h-2.5 w-4 rounded-full", ESTADO[e].dot)} /> {e}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full ring-1 ring-red-500" style={{ backgroundImage: STRIPES }} /> Bloqueada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-ink-800" /> Hito (una sola fecha)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded bg-red-500" /> Hoy
        </span>
        <span className="text-slate-400">· El avance se estima por estado (0 / 50 / 80 / 100 %)</span>
      </div>

      {tareas.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">No hay actividades para mostrar con los filtros actuales.</p>
      ) : (
        <div ref={scroller} className="relative max-h-[70vh] overflow-auto overscroll-contain">
          <div className="flex" style={{ width: "max-content" }}>
            {/* ── Columna izquierda (tabla de actividades) ── */}
            <div ref={leftCol} className="sticky left-0 z-20 w-60 shrink-0 border-r border-white/80 bg-[#f4f7fb]/95 shadow-[6px_0_16px_-10px_rgb(15_27_45/0.25)] backdrop-blur-xl sm:w-[27rem]">
              <div
                className="sticky top-0 z-10 grid items-end border-b border-white/70 bg-white/80 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-xl sm:grid-cols-[4.5rem_1fr_4.25rem_4.25rem_2.5rem]"
                style={{ height: HEADER }}
              >
                <span className="hidden sm:block">ID</span>
                <span>Actividad</span>
                <span className="hidden sm:block">Inicio</span>
                <span className="hidden sm:block">Fin</span>
                <span className="hidden text-right sm:block">Días</span>
              </div>
              {filas.map((f, i) => {
                if (f.kind === "grupo") {
                  const abierto = !cerrados.has(f.g.modulo);
                  return (
                    <button
                      key={`g-${f.g.modulo}`}
                      onClick={() => toggle(f.g.modulo)}
                      className="flex w-full items-center gap-1.5 border-b border-white/60 bg-white/40 px-2 text-left text-xs font-semibold text-ink-900 hover:bg-white/60"
                      style={{ height: ROW }}
                      aria-expanded={abierto}
                    >
                      {abierto ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{f.g.modulo}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] tabular-nums text-slate-600">
                        {f.g.items.length} · {f.g.pct}%
                      </span>
                    </button>
                  );
                }
                if (f.kind === "sinTitulo") {
                  return (
                    <div key="sin-t" className="flex items-center border-b border-white/60 bg-amber-50/50 px-3 text-xs font-semibold text-amber-800" style={{ height: ROW }}>
                      Sin fechas asignadas ({f.n})
                    </div>
                  );
                }
                const t = f.kind === "tarea" ? f.it.t : f.t;
                const it = f.kind === "tarea" ? f.it : null;
                return (
                  <div
                    key={`${f.kind}-${t.ID}-${i}`}
                    onClick={() => onSelect(t)}
                    onMouseEnter={() => setHover(t.ID)}
                    onMouseLeave={() => setHover(null)}
                    className={clsx(
                      "grid cursor-pointer items-center gap-x-2 border-b border-white/50 pl-6 pr-3 text-xs transition-colors sm:grid-cols-[4rem_1fr_4.25rem_4.25rem_2.5rem]",
                      hover === t.ID ? "bg-white/70" : "hover:bg-white/50",
                    )}
                    style={{ height: ROW }}
                  >
                    <span className="hidden truncate font-mono text-[10px] text-slate-400 sm:block">{t.ID}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-ink-900" title={t["Requerimiento/Tarea"]}>
                      {t.Bloqueado === "Sí" && <Lock className="h-3 w-3 shrink-0 text-red-600" />}
                      <span className="truncate">{t["Requerimiento/Tarea"]}</span>
                    </span>
                    <span className="hidden tabular-nums text-slate-600 sm:block">{it ? fechaCorta(it.s) : "—"}</span>
                    <span className={clsx("hidden tabular-nums sm:block", it && vencida(it) ? "font-semibold text-red-600" : "text-slate-600")}>
                      {it ? fechaCorta(it.e) : "—"}
                    </span>
                    <span className="hidden text-right tabular-nums text-slate-600 sm:block">{it ? it.e - it.s + 1 : "—"}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Diagrama ── */}
            <div className="relative shrink-0" style={{ width }}>
              {/* Encabezado de dos niveles */}
              <div className="sticky top-0 z-10 border-b border-white/70 bg-white/60 backdrop-blur-xl" style={{ height: HEADER }}>
                <div className="relative h-7 border-b border-white/60">
                  {top.map((s) => (
                    <div
                      key={s.k}
                      className="absolute top-0 flex h-full items-center truncate border-l border-slate-400/25 px-2 text-[11px] font-semibold text-ink-900"
                      style={{ left: s.from * px, width: s.len * px }}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
                <div className="relative h-7">
                  {bottom.map((s) => {
                    const d = start + s.from;
                    const finde = zoom === "dia" && (dow(d) === 0 || dow(d) === 6);
                    return (
                      <div
                        key={s.k}
                        className={clsx(
                          "absolute top-0 flex h-full items-center justify-center truncate border-l border-slate-400/20 text-[10px] tabular-nums",
                          zoom === "dia" && d === today ? "font-bold text-red-600" : finde ? "text-slate-400" : "text-slate-600",
                        )}
                        style={{ left: s.from * px, width: s.len * px }}
                      >
                        {s.label}
                      </div>
                    );
                  })}
                </div>
                <div className="absolute -bottom-px z-10 -translate-x-1/2 rounded-t-md bg-red-500 px-1.5 text-[9px] font-bold uppercase text-white" style={{ left: x(today) + px / 2 }}>
                  Hoy
                </div>
              </div>

              {/* Cuadrícula de fondo */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: HEADER }}>
                {zoom !== "mes" &&
                  Array.from({ length: days }, (_, i) => start + i)
                    .filter((d) => dow(d) === 0 || dow(d) === 6)
                    .map((d) => <div key={d} className="absolute inset-y-0 bg-slate-500/[0.06]" style={{ left: x(d), width: px }} />)}
                {bottom.map((s) => (
                  <div key={s.k} className="absolute inset-y-0 border-l border-slate-400/15" style={{ left: s.from * px }} />
                ))}
                <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-red-500/80 shadow-[0_0_8px_rgb(239_68_68/0.6)]" style={{ left: x(today) + px / 2 }} />
              </div>

              {/* Filas */}
              {filas.map((f, i) => {
                if (f.kind === "grupo") {
                  const { g } = f;
                  const l = x(g.s);
                  const w = (g.e - g.s + 1) * px;
                  return (
                    <div key={`gb-${g.modulo}`} className="relative border-b border-white/60 bg-white/15" style={{ height: ROW }}>
                      {/* Barra resumen estilo MS Project */}
                      <div className="absolute top-[15px] h-2.5" style={{ left: l, width: w }} title={`${g.modulo}: ${fechaCorta(g.s)} → ${fechaCorta(g.e)} · ${g.pct}%`}>
                        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-ink-800/80">
                          <div className="h-full bg-brand-500" style={{ width: `${g.pct}%` }} />
                        </div>
                        <span className="absolute -bottom-0.5 left-0 h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink-800/80" />
                        <span className="absolute -bottom-0.5 right-0 h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink-800/80" />
                      </div>
                      <span className="absolute top-2.5 whitespace-nowrap text-[10px] font-semibold text-slate-600" style={{ left: l + w + 8 }}>
                        {g.pct}%
                      </span>
                    </div>
                  );
                }
                if (f.kind === "sinTitulo") return <div key="sin-tb" className="border-b border-white/60 bg-amber-50/30" style={{ height: ROW }} />;
                if (f.kind === "sin") {
                  return (
                    <div
                      key={`sb-${f.t.ID}-${i}`}
                      className={clsx("relative border-b border-white/50", hover === f.t.ID && "bg-white/40")}
                      style={{ height: ROW }}
                      onMouseEnter={() => setHover(f.t.ID)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <button
                        onClick={() => onSelect(f.t)}
                        className="sticky left-[16rem] ml-3 mt-2 rounded-full border border-dashed border-amber-400/80 bg-amber-50/60 px-3 py-0.5 text-[11px] text-amber-800 sm:left-[28rem]"
                      >
                        Asignar fechas
                      </button>
                    </div>
                  );
                }

                const { it } = f;
                const { t } = it;
                const c = ESTADO[t.Estado] ?? ESTADO["Por Hacer"];
                const bloq = t.Bloqueado === "Sí";
                const l = x(it.s);
                const w = (it.e - it.s + 1) * px;
                const tip = `${t.ID} · ${t["Requerimiento/Tarea"]}\n${t.Estado} · ${t.Responsable || "Sin asignar"}\n${fechaCorta(it.s)} → ${fechaCorta(it.e)} (${it.e - it.s + 1} días)${bloq ? `\nBLOQUEADA: ${t.Detalle_Bloqueo}` : ""}${vencida(it) ? "\nVENCIDA" : ""}`;
                return (
                  <div
                    key={`tb-${t.ID}-${i}`}
                    className={clsx("relative border-b border-white/50 transition-colors", hover === t.ID && "bg-white/40")}
                    style={{ height: ROW }}
                    onMouseEnter={() => setHover(t.ID)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {it.hito ? (
                      <button
                        onClick={() => onSelect(t)}
                        title={tip}
                        aria-label={tip}
                        className={clsx(
                          "absolute top-3 h-3.5 w-3.5 rotate-45 rounded-[3px] shadow-md ring-2 ring-white/80 transition hover:scale-125",
                          bloq ? "bg-red-600" : c.fill,
                        )}
                        style={{ left: l + px / 2 - 7 }}
                      />
                    ) : (
                      <button
                        onClick={() => onSelect(t)}
                        title={tip}
                        aria-label={tip}
                        className={clsx(
                          "absolute top-2 h-6 overflow-hidden rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_2px_6px_-2px_rgb(15_27_45/0.25)] ring-1 backdrop-blur-sm transition hover:-translate-y-px hover:shadow-lg",
                          bloq ? "bg-red-100/50 ring-red-500" : c.track.split(" ")[0],
                          !bloq && (vencida(it) ? "ring-2 ring-red-400" : c.track.split(" ")[1]),
                        )}
                        style={{ left: l, width: Math.max(w, 8) }}
                      >
                        <span className={clsx("absolute inset-y-0 left-0 rounded-full", c.fill)} style={{ width: `${it.pct}%` }} />
                        {bloq && <span className="absolute inset-0" style={{ backgroundImage: STRIPES }} />}
                        {w > 46 && (
                          <span className={clsx("relative px-2 text-[10px] font-semibold tabular-nums", it.pct >= 50 ? "text-white" : "text-ink-900")}>
                            {it.pct}%
                          </span>
                        )}
                      </button>
                    )}
                    <span
                      className="pointer-events-none absolute top-3 flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-600"
                      style={{ left: l + (it.hito ? px / 2 + 12 : Math.max(w, 8) + 8) }}
                    >
                      {bloq && <Lock className="h-3 w-3 text-red-600" />}
                      {t.Responsable || "Sin asignar"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
