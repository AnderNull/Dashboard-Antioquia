"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Activity, AlertTriangle, BrainCircuit, ClipboardCheck, Landmark, Loader2, RefreshCw, Sparkles, Wrench } from "lucide-react";
import type { AnalysisResponse } from "@/lib/analysisSchema";

const CACHE_KEY = "taxation-smart:last-analysis";

const SALUD_STYLE = {
  Saludable: { ring: "ring-emerald-200 bg-emerald-50 text-emerald-800", bar: "bg-emerald-500", label: "✓ Saludable" },
  "En Riesgo": { ring: "ring-amber-200 bg-amber-50 text-amber-800", bar: "bg-amber-500", label: "▲ En riesgo" },
  Crítico: { ring: "ring-red-200 bg-red-50 text-red-800", bar: "bg-red-500", label: "■ Crítico" },
} as const;

const PRIO_STYLE: Record<string, string> = {
  Alta: "bg-red-50 text-red-700",
  Media: "bg-amber-50 text-amber-700",
  Baja: "bg-slate-100 text-slate-600",
};

export default function AnalysisPanel({ canRun }: { canRun: boolean }) {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) setData(JSON.parse(cached));
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/analysis", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
      setData(body);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(body));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const a = data?.analysis;
  const salud = a ? SALUD_STYLE[a.salud_proyecto.estado] : null;
  const puntaje = a ? Math.max(0, Math.min(100, Math.round(a.salud_proyecto.puntaje))) : 0;
  const tec = a ? Math.round(a.responsabilidad_bloqueos.tecnico_equipo_pct) : 0;
  const gob = a ? Math.round(a.responsabilidad_bloqueos.gobernacion_pct) : 0;

  return (
    <div className="space-y-6">
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-series-1 text-white">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-ink-900">Diagnóstico del proyecto con Claude</p>
            <p className="text-xs text-slate-500">
              {data
                ? `Último análisis: ${new Date(data.generatedAt).toLocaleString("es-CO")} · ${data.model}`
                : "Analiza salud, responsabilidad de bloqueos y acciones de mitigación"}
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading || !canRun}
          title={canRun ? undefined : "No tienes el permiso «Generar análisis con IA»"}
          className="btn-primary"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : data ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analizando datos…" : data ? "Regenerar análisis" : "Generar análisis"}
        </button>
      </div>

      {error && (
        <div role="alert" className="card flex items-start gap-2 !border-red-200/80 !bg-red-50/70 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading && !a && (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="card h-40 animate-pulse" />)}
        </div>
      )}

      {!a && !loading && !error && (
        <div className="card p-12 text-center text-sm text-slate-500">
          Pulsa <b>Generar análisis</b> para que Claude evalúe los datos vigentes de las pestañas Proyectos_Tareas, Levantamientos y Bloqueos_Log.
        </div>
      )}

      {a && salud && (
        <div className={clsx("space-y-6 transition", loading && "opacity-50")}>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Salud */}
            <section className="card p-5 lg:col-span-2">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><Activity className="h-4 w-4 text-gov-600" /> Salud del proyecto</h3>
              <div className="flex flex-wrap items-center gap-4">
                <span className={clsx("rounded-full px-3 py-1 text-sm font-semibold ring-1", salud.ring)}>{salud.label}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-slate-500"><span>Puntaje</span><span className="font-semibold tabular-nums text-ink-900">{puntaje}/100</span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70"><div className={clsx("h-full rounded-full", salud.bar)} style={{ width: `${puntaje}%` }} /></div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-700">{a.salud_proyecto.resumen}</p>
              {a.salud_proyecto.riesgos_principales.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {a.salud_proyecto.riesgos_principales.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /> {r}</li>
                  ))}
                </ul>
              )}
            </section>

            {/* Levantamientos */}
            <section className="card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><ClipboardCheck className="h-4 w-4 text-series-1" /> Levantamientos</h3>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Total", a.metricas_levantamientos.total],
                  ["Aprobados", a.metricas_levantamientos.aprobados],
                  ["Pendientes", a.metricas_levantamientos.pendientes],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/50 p-2 ring-1 ring-white/70">
                    <dt className="text-[11px] text-slate-500">{k}</dt>
                    <dd className="text-xl font-bold tabular-nums text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-slate-500">Tasa de aprobación: <b className="tabular-nums text-ink-900">{Math.round(a.metricas_levantamientos.tasa_aprobacion_pct)}%</b></p>
              <p className="mt-2 text-sm text-slate-700">{a.metricas_levantamientos.analisis}</p>
            </section>
          </div>

          {/* Responsabilidad */}
          <section className="card p-5">
            <h3 className="mb-4 font-semibold text-ink-900">Responsabilidad de los bloqueos</h3>
            <div className="flex h-8 overflow-hidden rounded-lg ring-1 ring-white/70 text-xs font-semibold text-white">
              {tec > 0 && <div className="flex items-center justify-center bg-[#2a78d6]" style={{ width: `${tec}%` }}>{tec}%</div>}
              {tec > 0 && gob > 0 && <div className="w-0.5 bg-white" />}
              {gob > 0 && <div className="flex items-center justify-center bg-[#eb6834]" style={{ width: `${gob}%` }}>{gob}%</div>}
              {tec === 0 && gob === 0 && <div className="flex w-full items-center justify-center bg-white/50 text-slate-500">Sin bloqueos registrados</div>}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /><span className="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" /> Equipo técnico · {tec}%</span>
              <span className="flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5" /><span className="h-2.5 w-2.5 rounded-sm bg-[#eb6834]" /> Respuesta Gobernación · {gob}%</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{a.responsabilidad_bloqueos.analisis}</p>
            {a.responsabilidad_bloqueos.bloqueos_criticos.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr><th className="py-2 pr-3">Tarea</th><th className="px-3 py-2">Responsable</th><th className="py-2 pl-3">Motivo</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/60">
                    {a.responsabilidad_bloqueos.bloqueos_criticos.map((b, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-3 font-mono text-xs">{b.tarea_id}</td>
                        <td className="whitespace-nowrap px-3 py-2">{b.responsable}</td>
                        <td className="py-2 pl-3 text-slate-700">{b.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Acciones */}
          <section>
            <h3 className="mb-3 font-semibold text-ink-900">Acciones de mitigación recomendadas</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {a.acciones_mitigacion.slice(0, 3).map((ac, i) => (
                <article key={i} className="card flex flex-col p-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white">{i + 1}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIO_STYLE[ac.prioridad])}>Prioridad {ac.prioridad}</span>
                  </div>
                  <h4 className="font-semibold text-ink-900">{ac.titulo}</h4>
                  <p className="mt-2 flex-1 text-sm text-slate-700">{ac.descripcion}</p>
                  <div className="mt-4 flex justify-between border-t border-white/60 pt-3 text-xs text-slate-500">
                    <span>👤 {ac.responsable}</span>
                    <span>⏱ {ac.plazo}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <p className="text-xs text-slate-400">El diagnóstico es generado por IA y debe ser validado por el equipo de PMO antes de tomar decisiones.</p>
        </div>
      )}
    </div>
  );
}
