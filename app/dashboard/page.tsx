import { AlertOctagon, CheckCircle2, ClipboardList, Timer } from "lucide-react";
import { getProjectData } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { ESTADOS_TAREA, TIPOS_BLOQUEO } from "@/lib/types";
import { DataError, PageHeader } from "@/components/ui";
import OverviewCharts, { type ModuloRow } from "@/components/OverviewCharts";

export default async function OverviewPage() {
  const res = await safeLoad(getProjectData);

  return (
    <>
      <PageHeader title="Overview del proyecto" subtitle="TAXATION SMART · Avance general y por módulo tributario" />
      {res.error !== null ? <DataError message={res.error} /> : <Overview {...res.data} />}
    </>
  );
}

function Overview({ tareas, levantamientos, bloqueos }: Awaited<ReturnType<typeof getProjectData>>) {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.Estado === "Completado").length;
  const enCurso = tareas.filter((t) => t.Estado === "En Progreso" || t.Estado === "En Revisión").length;
  const bloqueosActivos = Math.max(
    bloqueos.filter((b) => b.Estado !== "Resuelto").length,
    tareas.filter((t) => t.Bloqueado === "Sí").length,
  );
  const pct = total ? Math.round((completadas / total) * 100) : 0;

  const porModulo = new Map<string, ModuloRow>();
  for (const t of tareas) {
    const m = t.Modulo_Taxation || "Sin módulo";
    const row =
      porModulo.get(m) ??
      ({ modulo: m, "Por Hacer": 0, "En Progreso": 0, "En Revisión": 0, Completado: 0, total: 0, avance: 0, bloqueadas: 0 } as ModuloRow);
    if ((ESTADOS_TAREA as readonly string[]).includes(t.Estado)) row[t.Estado] += 1;
    row.total += 1;
    if (t.Bloqueado === "Sí") row.bloqueadas += 1;
    porModulo.set(m, row);
  }
  const modulos = [...porModulo.values()]
    .map((r) => ({ ...r, avance: r.total ? Math.round((r.Completado / r.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  const porTipo = TIPOS_BLOQUEO.map((tipo) => ({
    tipo,
    abiertos: bloqueos.filter((b) => b.Tipo_Bloqueo === tipo && b.Estado !== "Resuelto").length,
  }));

  const kpis = [
    { label: "Total requerimientos", value: total, hint: `${levantamientos.length} levantamientos registrados`, icon: ClipboardList, tone: "text-series-1 bg-series-1/10" },
    { label: "Tareas completadas", value: completadas, hint: `${pct}% de avance global`, icon: CheckCircle2, tone: "text-brand-600 bg-brand-50" },
    { label: "En curso", value: enCurso, hint: "En progreso + en revisión", icon: Timer, tone: "text-amber-600 bg-amber-50" },
    { label: "Bloqueos activos", value: bloqueosActivos, hint: "Abiertos o en gestión", icon: AlertOctagon, tone: "text-red-600 bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, hint, icon: Icon, tone }) => (
          <div key={label} className="card glass-hover p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`rounded-lg p-2 ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink-900">Avance global</span>
          <span className="tabular-nums text-slate-500">{completadas} / {total} tareas · {pct}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {total === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          Aún no hay tareas en la pestaña <b>Proyectos_Tareas</b>. Créalas desde el tablero Kanban.
        </div>
      ) : (
        <OverviewCharts modulos={modulos} porTipo={porTipo} />
      )}
    </div>
  );
}
