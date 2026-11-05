"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlarmClock,
  BarChart3,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  Hourglass,
  ListTodo,
  Lock,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Table2,
  TriangleAlert,
  User,
} from "lucide-react";
import type { Tarea } from "@/lib/types";
import { fmtDay } from "@/lib/dates";
import { clasificar, porUsuario, responsables, type TareaCtx } from "@/lib/metrics";

const REFRESH_S = 60;

// Paleta categórica validada del proyecto (orden fijo; el color sigue a la situación)
const SERIES = [
  { key: "enEjecucion", label: "En ejecución", color: "#1baf7a" },
  { key: "sinIniciar", label: "Sin iniciar (ya debía)", color: "#eda100" },
  { key: "programadas", label: "Programadas", color: "#2a78d6" },
  { key: "vencidas", label: "Vencidas", color: "#eb6834" },
] as const;
const AXIS = { fontSize: 12, fill: "#52514e" };

const SIT_CHIP = {
  en_ejecucion: { label: "En curso", icon: PlayCircle, cls: "bg-emerald-50/80 text-emerald-700 ring-emerald-200" },
  sin_iniciar: { label: "Sin iniciar", icon: Hourglass, cls: "bg-amber-50/80 text-amber-800 ring-amber-200" },
  vencida: { label: "Vencida", icon: TriangleAlert, cls: "bg-red-50/80 text-red-700 ring-red-200" },
  programada: { label: "Programada", icon: CalendarClock, cls: "bg-sky-50/80 text-sky-700 ring-sky-200" },
  sin_fechas: { label: "Sin fechas", icon: CircleDashed, cls: "bg-slate-50/80 text-slate-600 ring-slate-200" },
  completada: { label: "Completada", icon: CheckCircle2, cls: "bg-emerald-50/80 text-emerald-700 ring-emerald-200" },
} as const;

const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
const corta = (d: number) => fmtDay(d, { day: "2-digit", month: "short" });

function restante(c: TareaCtx) {
  const d = c.diasRestantes;
  if (d === null) return "Sin fecha de entrega";
  if (d < 0) return `Vencida hace ${plural(-d, "día")}`;
  if (d === 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  return `Faltan ${d} días`;
}

function Chip({ c }: { c: TareaCtx }) {
  const k = c.bloqueada ? null : SIT_CHIP[c.situacion];
  if (!k)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50/80 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200">
        <Lock className="h-3 w-3" /> Bloqueada
      </span>
    );
  const Icon = k.icon;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", k.cls)}>
      <Icon className="h-3 w-3" /> {k.label}
    </span>
  );
}

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-semibold text-ink-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold tabular-nums text-ink-900">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function MetricsBoard({ initialTareas }: { initialTareas: Tarea[] }) {
  const [tareas, setTareas] = useState(initialTareas);
  const [now, setNow] = useState<Date | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [auto, setAuto] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabla, setTabla] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
      setTareas(body as Tarea[]);
      setLastSync(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reloj en vivo (se inicia en el navegador para usar su zona horaria)
  useEffect(() => {
    setNow(new Date());
    setLastSync(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Actualización automática cada minuto
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, REFRESH_S * 1000);
    return () => clearInterval(id);
  }, [auto, refresh]);

  const today = now ? Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000 : null;

  const m = useMemo(() => {
    if (today === null) return null;
    const ctx = tareas.map((t) => clasificar(t, today));
    const pend = ctx.filter((c) => c.situacion !== "completada");
    const by = (s: TareaCtx["situacion"]) => ctx.filter((c) => c.situacion === s);
    const ahora = ctx
      .filter((c) => c.enVentana || c.situacion === "en_ejecucion")
      .sort((a, b) => Number(b.bloqueada) - Number(a.bloqueada) || (a.diasRestantes ?? 9e9) - (b.diasRestantes ?? 9e9));
    const vencidas = by("vencida").sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));
    const programadas = by("programada");
    const vencen7 = pend.filter((c) => c.situacion !== "vencida" && c.diasRestantes !== null && c.diasRestantes <= 7);

    // Agenda de los próximos 14 días: inicios y entregas
    const agenda = new Map<number, { tipo: "Inicio" | "Entrega"; c: TareaCtx }[]>();
    for (const c of pend) {
      const add = (d: number | null, tipo: "Inicio" | "Entrega") => {
        if (d === null || d < today || d > today + 14) return;
        agenda.set(d, [...(agenda.get(d) ?? []), { tipo, c }]);
      };
      if (c.situacion === "programada") add(c.s, "Inicio");
      add(c.e, "Entrega");
    }

    return {
      ctx,
      pend,
      ahora,
      vencidas,
      programadas,
      vencen7,
      sinIniciar: by("sin_iniciar"),
      enEjecucion: by("en_ejecucion"),
      sinFechas: by("sin_fechas"),
      completadas: by("completada"),
      bloqueadas: ctx.filter((c) => c.bloqueada),
      enVentana: ctx.filter((c) => c.enVentana),
      usuarios: porUsuario(ctx),
      agenda: [...agenda.entries()].sort((a, b) => a[0] - b[0]),
      prog7: programadas.filter((c) => c.s !== null && c.s - today <= 7).length,
      // Puntualidad: completadas con fecha prevista y fecha real de finalización
      puntualidad: (() => {
        const medibles = ctx.filter((c) => c.situacion === "completada" && c.t.Fecha_Entrega && c.t.Fecha_Finalizacion);
        return { medibles: medibles.length, aTiempo: medibles.filter((c) => c.t.Fecha_Finalizacion! <= c.t.Fecha_Entrega).length };
      })(),
    };
  }, [tareas, today]);

  if (!m || !now || today === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card h-32 animate-pulse" />)}
      </div>
    );
  }

  const seg = lastSync ? Math.max(0, Math.round((now.getTime() - lastSync.getTime()) / 1000)) : 0;
  const proxima = Math.max(0, REFRESH_S - seg);

  // Resumen en lenguaje natural
  const resumen: string[] = [];
  resumen.push(
    m.enVentana.length
      ? `Hoy deberían estar en ejecución ${plural(m.enVentana.length, "actividad", "actividades")} según su plan: ${m.enVentana.filter((c) => c.situacion === "en_ejecucion").length} en curso y ${m.sinIniciar.length} aún sin iniciar.`
      : "Hoy no hay actividades cuya ventana de fechas incluya el día actual.",
  );
  if (m.vencidas.length) resumen.push(`${plural(m.vencidas.length, "actividad vencida", "actividades vencidas")} sin completar, la más atrasada por ${plural(-(m.vencidas[0].diasRestantes ?? 0), "día")}.`);
  if (m.bloqueadas.length)
    resumen.push(`${plural(m.bloqueadas.length, "actividad bloqueada", "actividades bloqueadas")} ${m.bloqueadas.length === 1 ? "frena" : "frenan"} el avance.`);
  if (m.vencen7.length) resumen.push(`${plural(m.vencen7.length, "entrega vence", "entregas vencen")} en los próximos 7 días.`);
  if (m.programadas.length)
    resumen.push(
      `${plural(m.programadas.length, "actividad programada", "actividades programadas")} a futuro (${m.prog7} ${m.prog7 === 1 ? "inicia" : "inician"} en los próximos 7 días).`,
    );
  const topCarga = m.usuarios.find((u) => u.responsable !== "Sin asignar" && u.pendientes > 0);
  if (topCarga) resumen.push(`Mayor carga pendiente: ${topCarga.responsable} con ${plural(topCarga.pendientes, "actividad", "actividades")}.`);
  if (m.sinFechas.length)
    resumen.push(`${plural(m.sinFechas.length, "actividad", "actividades")} sin fechas ${m.sinFechas.length === 1 ? "no puede" : "no pueden"} programarse.`);

  const kpis = [
    { label: "Tareas pendientes", value: m.pend.length, hint: `${m.completadas.length} completadas de ${m.ctx.length}`, icon: ListTodo, tone: "text-series-1 bg-series-1/10" },
    { label: "Deben ejecutarse hoy", value: m.enVentana.length, hint: `${m.enVentana.filter((c) => c.situacion === "en_ejecucion").length} en curso · ${m.sinIniciar.length} sin iniciar`, icon: PlayCircle, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Programadas", value: m.programadas.length, hint: `${m.prog7} ${m.prog7 === 1 ? "inicia" : "inician"} en los próximos 7 días`, icon: CalendarClock, tone: "text-sky-700 bg-sky-50" },
    { label: "Vencen en 7 días", value: m.vencen7.length, hint: "Entregas próximas sin completar", icon: AlarmClock, tone: "text-amber-700 bg-amber-50" },
    { label: "Vencidas", value: m.vencidas.length, hint: "Entrega pasada sin completar", icon: TriangleAlert, tone: "text-red-600 bg-red-50" },
    { label: "Bloqueadas", value: m.bloqueadas.length, hint: "Activas, sin resolver", icon: Lock, tone: "text-red-600 bg-red-50" },
    { label: "Completadas", value: m.completadas.length, hint: `${m.ctx.length ? Math.round((m.completadas.length / m.ctx.length) * 100) : 0}% del total de actividades`, icon: CheckCircle2, tone: "text-gov-600 bg-gov-50" },
    {
      label: "Entregadas a tiempo",
      value: m.puntualidad.medibles ? `${Math.round((m.puntualidad.aTiempo / m.puntualidad.medibles) * 100)}%` : "—",
      hint: m.puntualidad.medibles
        ? `${m.puntualidad.aTiempo} de ${m.puntualidad.medibles} completadas con fecha prevista`
        : "Sin completadas con fecha de entrega y finalización",
      icon: CalendarClock,
      tone: "text-brand-600 bg-brand-50",
    },
  ];

  const chartUsers = m.usuarios.filter((u) => u.pendientes > 0);
  const alto = Math.max(200, chartUsers.length * 44 + 70);

  return (
    <div className="space-y-6">
      {/* Barra en vivo */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {auto && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={clsx("relative inline-flex h-3 w-3 rounded-full", auto ? "bg-emerald-500" : "bg-slate-400")} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase())} ·{" "}
              <span className="tabular-nums">{now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </p>
            <p className="text-xs text-slate-500">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : (
                <>
                  Datos de Google Sheets actualizados hace <span className="tabular-nums">{seg}</span> s
                  {auto && <> · próxima actualización en <span className="tabular-nums">{proxima}</span> s</>}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-emerald-600" />
            Tiempo real
          </label>
          <button onClick={refresh} disabled={loading} className="btn-ghost px-3 py-1.5 text-xs">
            <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} /> Actualizar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <section className="card p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
          <Sparkles className="h-4 w-4 text-violet-500" /> Resumen de lo que se debe estar ejecutando
        </h3>
        <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
          {resumen.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" /> {r}
            </li>
          ))}
        </ul>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, hint, icon: Icon, tone }) => (
          <div key={label} className="card glass-hover p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={clsx("rounded-lg p-2", tone)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* En ejecución ahora */}
        <section className="card overflow-hidden xl:col-span-2">
          <header className="border-b border-white/60 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-ink-900">
              <PlayCircle className="h-4 w-4 text-emerald-600" /> Qué se debe estar ejecutando ahora
            </h3>
            <p className="text-xs text-slate-500">Actividades cuya ventana de fechas incluye hoy, más las que ya están en curso</p>
          </header>
          {m.ahora.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No hay actividades en ejecución para hoy.</p>
          ) : (
            <ul className="divide-y divide-white/60">
              {m.ahora.map((c) => (
                <li key={c.t.ID} className="px-5 py-3.5 transition-colors hover:bg-white/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip c={c} />
                    <span className="font-mono text-[11px] text-slate-400">{c.t.ID}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900" title={c.t["Requerimiento/Tarea"]}>
                      {c.t["Requerimiento/Tarea"]}
                    </span>
                    <span className={clsx("text-xs tabular-nums", (c.diasRestantes ?? 99) <= 2 ? "font-semibold text-red-600" : "text-slate-500")}>
                      {restante(c)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {responsables(c.t).join(", ")}</span>
                    {c.t.Modulo_Taxation && <span>{c.t.Modulo_Taxation}</span>}
                    {c.s !== null && c.e !== null && <span className="tabular-nums">{corta(c.s)} → {corta(c.e)}</span>}
                  </div>
                  {c.avanceTiempo !== null && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70">
                        <div
                          className={clsx("h-full rounded-full", c.avanceTiempo >= 85 ? "bg-red-500" : c.avanceTiempo >= 60 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${c.avanceTiempo}%` }}
                        />
                      </div>
                      <span className="w-28 text-right text-[11px] tabular-nums text-slate-500">{c.avanceTiempo}% del plazo usado</span>
                    </div>
                  )}
                  {c.bloqueada && c.t.Detalle_Bloqueo && <p className="mt-1.5 text-xs text-red-700">Bloqueo: {c.t.Detalle_Bloqueo}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Vencidas */}
        <section className="card overflow-hidden">
          <header className="border-b border-white/60 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-ink-900">
              <TriangleAlert className="h-4 w-4 text-red-600" /> Vencidas sin completar
            </h3>
            <p className="text-xs text-slate-500">Ordenadas por días de atraso</p>
          </header>
          {m.vencidas.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Sin actividades vencidas 🎉</p>
          ) : (
            <ul className="divide-y divide-white/60">
              {m.vencidas.map((c) => (
                <li key={c.t.ID} className="px-5 py-3">
                  <p className="truncate text-sm font-medium text-ink-900" title={c.t["Requerimiento/Tarea"]}>{c.t["Requerimiento/Tarea"]}</p>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="truncate text-slate-500">{responsables(c.t).join(", ")} · {c.t.Estado}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-red-600">+{-(c.diasRestantes ?? 0)} d</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Por usuario */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink-900">Carga por responsable</h3>
            <p className="text-xs text-slate-500">Actividades pendientes de cada persona según su situación frente a la fecha de hoy</p>
          </div>
          <button onClick={() => setTabla((v) => !v)} className="btn-ghost px-3 py-1.5 text-xs" aria-pressed={tabla}>
            {tabla ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
            {tabla ? "Ver gráfico" : "Ver tabla"}
          </button>
        </div>
        {tabla || chartUsers.length === 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Responsable</th>
                  <th className="px-2 py-2 text-right">Pendientes</th>
                  <th className="px-2 py-2 text-right">Hoy</th>
                  <th className="px-2 py-2 text-right">En ejecución</th>
                  <th className="px-2 py-2 text-right">Sin iniciar</th>
                  <th className="px-2 py-2 text-right">Programadas</th>
                  <th className="px-2 py-2 text-right">Vencidas</th>
                  <th className="px-2 py-2 text-right">Bloqueadas</th>
                  <th className="px-2 py-2 text-right">Completadas</th>
                  <th className="py-2 pl-2 text-right">Cumplimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 tabular-nums">
                {m.usuarios.map((u) => (
                  <tr key={u.responsable} className="transition-colors hover:bg-white/30">
                    <td className="py-2 pr-3 font-medium text-ink-900">{u.responsable}</td>
                    <td className="px-2 py-2 text-right font-semibold">{u.pendientes}</td>
                    <td className="px-2 py-2 text-right">{u.enVentanaHoy}</td>
                    <td className="px-2 py-2 text-right">{u.enEjecucion}</td>
                    <td className="px-2 py-2 text-right">{u.sinIniciar}</td>
                    <td className="px-2 py-2 text-right">{u.programadas}</td>
                    <td className={clsx("px-2 py-2 text-right", u.vencidas > 0 && "font-semibold text-red-600")}>{u.vencidas}</td>
                    <td className="px-2 py-2 text-right">{u.bloqueadas}</td>
                    <td className="px-2 py-2 text-right">{u.completadas}</td>
                    <td className="py-2 pl-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70">
                          <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${u.cumplimiento}%` }} />
                        </div>
                        <span className="w-9 font-semibold">{u.cumplimiento}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {m.usuarios.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No hay tareas registradas.</p>}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={alto}>
            <BarChart data={chartUsers} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="#e7e6e2" />
              <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="responsable" width={140} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(255,255,255,0.45)" }} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#52514e" }} />
              {SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="carga"
                  fill={s.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  radius={i === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Agenda */}
      <section className="card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-ink-900">
          <CalendarRange className="h-4 w-4 text-series-1" /> Agenda de los próximos 14 días
        </h3>
        <p className="mb-4 text-xs text-slate-500">Inicios programados y entregas pendientes</p>
        {m.agenda.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No hay inicios ni entregas en los próximos 14 días.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-white/80 pl-5">
            {m.agenda.map(([d, evs]) => (
              <li key={d} className="relative">
                <span className={clsx("absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white/60", d === today ? "bg-red-500" : "bg-series-1")} />
                <p className="text-xs font-semibold text-ink-900">
                  {d === today ? "Hoy" : d === today + 1 ? "Mañana" : fmtDay(d, { weekday: "long", day: "numeric", month: "short" }).replace(/^./, (c) => c.toUpperCase())}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {evs.map(({ tipo, c }) => (
                    <li key={`${tipo}-${c.t.ID}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/35 px-3 py-2 text-xs ring-1 ring-white/70">
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                          tipo === "Inicio" ? "bg-sky-50/80 text-sky-700 ring-sky-200" : "bg-amber-50/80 text-amber-800 ring-amber-200",
                        )}
                      >
                        {tipo}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{c.t["Requerimiento/Tarea"]}</span>
                      <span className="text-slate-500">{responsables(c.t).join(", ")}</span>
                      {c.bloqueada && <Lock className="h-3 w-3 text-red-600" aria-label="Bloqueada" />}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
