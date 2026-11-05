"use client";

import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Flame,
  Inbox,
  Search,
  Ticket,
  User,
  UserPen,
} from "lucide-react";
import { Modal } from "./ui";
import type { RequerimientoPlataforma as Req } from "@/lib/types";

/* ───────────────────────── Etapas y prioridades ───────────────────────── */

const ETAPAS = [
  { key: "En Desarrollo", color: "#2f6fe4", chip: "bg-brand-50/90 text-brand-600 ring-brand-100" },
  { key: "En QA", color: "#7c5ce6", chip: "bg-violet-50/90 text-violet-700 ring-violet-200" },
  { key: "Revisión Director", color: "#e0a100", chip: "bg-amber-50/90 text-amber-800 ring-amber-200" },
  { key: "Resuelto", color: "#13a052", chip: "bg-gov-50/90 text-gov-600 ring-emerald-200" },
  { key: "Cerrado", color: "#7a8396", chip: "bg-slate-100/90 text-slate-600 ring-slate-200" },
] as const;
const CERRADAS = new Set(["Resuelto", "Cerrado"]);
const abierto = (r: Req) => !CERRADAS.has(r.Etapa);
const etapaInfo = (e: string) => ETAPAS.find((x) => x.key === e) ?? { key: e, color: "#94a3b8", chip: "bg-white/70 text-slate-600 ring-white" };

const PRIORIDADES = ["inmediata", "urgente", "alta", "normal", "baja", "ninguna"];
const PRIO_STYLE: Record<string, string> = {
  inmediata: "bg-red-600 text-white ring-red-600",
  urgente: "bg-red-50 text-red-700 ring-red-200",
  alta: "bg-amber-50 text-amber-800 ring-amber-200",
  normal: "bg-white/70 text-slate-600 ring-slate-200",
  baja: "bg-white/50 text-slate-500 ring-slate-200",
  ninguna: "bg-white/40 text-slate-400 ring-slate-200",
};
const prioRank = (p: string) => {
  const i = PRIORIDADES.indexOf(p.toLowerCase());
  return i < 0 ? PRIORIDADES.length : i;
};
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
const humanEstado = (s: string) => cap(s.replace(/_/g, " "));
const dias = (r: Req) => Number(r.Dias_Abiertos) || 0;

const fecha = (s: string, conHora = false) => {
  if (!s) return "—";
  const [d, h] = s.split(" ");
  const [y, m, dd] = d.split("-").map(Number);
  if (!y) return s;
  const txt = new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString("es-CO", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
  return conHora && h ? `${txt} · ${h}` : txt;
};

type SortKey = "ID" | "Creado" | "Dias" | "Prioridad";

/* ───────────────────────── Componente ───────────────────────── */

export default function RequerimientosBoard({ items }: { items: Req[] }) {
  const [q, setQ] = useState("");
  const [etapa, setEtapa] = useState<string>("abiertos");
  const [modulo, setModulo] = useState("");
  const [asignado, setAsignado] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "Prioridad", dir: 1 });
  const [detalle, setDetalle] = useState<Req | null>(null);

  const abiertos = items.filter(abierto);
  const cerrados = items.filter((r) => !abierto(r));
  const criticos = abiertos.filter((r) => ["inmediata", "urgente"].includes(r.Prioridad.toLowerCase()));
  const resolucion = cerrados.length ? cerrados.reduce((a, r) => a + dias(r), 0) / cerrados.length : 0;
  const masAntiguo = abiertos.reduce<Req | null>((m, r) => (!m || dias(r) > dias(m) ? r : m), null);
  const ultimaImportacion = items.reduce((m, r) => (r.Fecha_Importacion > m ? r.Fecha_Importacion : m), "");

  const etapasPresentes = [...ETAPAS.map((e) => e.key as string), ...new Set(items.map((r) => r.Etapa).filter((e) => !ETAPAS.some((x) => x.key === e)))];
  const conteoEtapa = (e: string) => items.filter((r) => r.Etapa === e).length;
  const opciones = (k: keyof Req) => [...new Set(items.map((r) => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));

  // Carga abierta por responsable, desglosada por etapa
  const carga = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const r of abiertos) {
      const k = r.Asignado_A || "Sin asignar";
      const row = m.get(k) ?? {};
      row[r.Etapa] = (row[r.Etapa] ?? 0) + 1;
      m.set(k, row);
    }
    return [...m.entries()]
      .map(([nombre, porEtapa]) => ({ nombre, porEtapa, total: Object.values(porEtapa).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [abiertos]);
  const maxCarga = Math.max(1, ...carga.map((c) => c.total));

  const porModulo = useMemo(() => {
    const m = new Map<string, { abiertos: number; cerrados: number }>();
    for (const r of items) {
      const k = r.Modulo || "Sin módulo";
      const row = m.get(k) ?? { abiertos: 0, cerrados: 0 };
      if (abierto(r)) row.abiertos++;
      else row.cerrados++;
      m.set(k, row);
    }
    return [...m.entries()].map(([nombre, v]) => ({ nombre, ...v, total: v.abiertos + v.cerrados })).sort((a, b) => b.total - a.total);
  }, [items]);
  const maxModulo = Math.max(1, ...porModulo.map((m) => m.total));

  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter((r) => (etapa === "abiertos" ? abierto(r) : etapa === "todos" ? true : r.Etapa === etapa))
      .filter((r) => !modulo || r.Modulo === modulo)
      .filter((r) => !asignado || r.Asignado_A === asignado)
      .filter((r) => !prioridad || r.Prioridad.toLowerCase() === prioridad)
      .filter((r) => !s || [r.ID, r.Titulo, r.Modulo, r.Asignado_A, r.Reportado_Por, r.Impuesto].some((v) => v?.toLowerCase().includes(s)))
      .sort((a, b) => {
        const d = sort.dir;
        switch (sort.key) {
          case "ID":
            return (Number(a.ID) - Number(b.ID)) * d;
          case "Creado":
            return a.Creado.localeCompare(b.Creado) * d;
          case "Dias":
            return (dias(a) - dias(b)) * d;
          default:
            return (prioRank(a.Prioridad) - prioRank(b.Prioridad)) * d || b.Creado.localeCompare(a.Creado);
        }
      });
  }, [items, q, etapa, modulo, asignado, prioridad, sort]);

  const th = (key: SortKey, label: string, className = "") => (
    <th className={clsx("px-3 py-2.5", className)}>
      <button
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "Prioridad" ? 1 : -1 }))}
        className="inline-flex items-center gap-1 uppercase"
      >
        {label} <ArrowUpDown className={clsx("h-3 w-3", sort.key === key ? "text-brand-600" : "text-slate-300")} />
      </button>
    </th>
  );

  function exportar() {
    const cols: (keyof Req)[] = ["ID", "Titulo", "Etapa", "Estado", "Modulo", "Impuesto", "Asignado_A", "Reportado_Por", "Prioridad", "Creado", "Ultima_Transicion", "Dias_Abiertos"];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...visibles.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `requerimientos-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (items.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-slate-600">
        <Inbox className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        Aún no hay requerimientos importados. Exporta el reporte <b>Requerimientos de Mis Clientes</b> desde la plataforma e impórtalo con{" "}
        <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">npm run import-requerimientos</code>.
      </div>
    );
  }

  const kpis = [
    { label: "Requerimientos", value: items.length, hint: `${cerrados.length} resueltos o cerrados`, icon: Ticket, tone: "text-brand-600 bg-brand-50" },
    { label: "Abiertos", value: abiertos.length, hint: ETAPAS.filter((e) => !CERRADAS.has(e.key)).map((e) => `${conteoEtapa(e.key)} ${e.key.toLowerCase()}`).join(" · "), icon: Clock3, tone: "text-amber-700 bg-amber-50" },
    { label: "Inmediatos / urgentes abiertos", value: criticos.length, hint: masAntiguo ? `Más antiguo: #${masAntiguo.ID} · ${dias(masAntiguo)} días hábiles` : "Sin abiertos", icon: Flame, tone: "text-red-600 bg-red-50" },
    { label: "Resolución promedio", value: `${resolucion.toFixed(1)} d`, hint: "Días hábiles desde la creación hasta resolver/cerrar", icon: CheckCircle2, tone: "text-gov-600 bg-gov-50" },
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Fuente: plataforma de requerimientos · última importación {fecha(ultimaImportacion, true)} UTC · Los días son hábiles, tal como los calcula la plataforma.
      </p>

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

      {/* Flujo por etapa */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink-900">Flujo por etapa</h3>
            <p className="text-xs text-slate-500">Haz clic en una etapa para filtrar la tabla</p>
          </div>
          <div className="flex gap-1.5 text-xs">
            {[
              ["abiertos", `Abiertos (${abiertos.length})`],
              ["todos", `Todos (${items.length})`],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setEtapa(k)} className={clsx("rounded-full px-3 py-1 font-medium ring-1 transition", etapa === k ? "bg-ink-800 text-white ring-ink-800" : "bg-white/50 text-slate-600 ring-white/80 hover:bg-white/80")}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {etapasPresentes.map((e, i) => {
            const info = etapaInfo(e);
            const n = conteoEtapa(e);
            return (
              <Fragment key={e}>
                {i > 0 && <ChevronRight className="hidden h-5 w-5 self-center text-slate-300 sm:block" />}
                <button
                  onClick={() => setEtapa(etapa === e ? "abiertos" : e)}
                  className={clsx(
                    "min-w-[8.5rem] flex-1 rounded-2xl bg-white/45 p-3 text-left ring-1 transition hover:bg-white/70",
                    etapa === e ? "ring-2 ring-brand-500" : "ring-white/80",
                  )}
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: info.color }} /> {e}
                  </span>
                  <span className="mt-1 block text-2xl font-bold tabular-nums text-ink-900">{n}</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/70">
                    <span className="block h-full rounded-full" style={{ width: `${(n / items.length) * 100}%`, background: info.color }} />
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Carga por responsable */}
        <section className="card p-5">
          <h3 className="font-semibold text-ink-900">Abiertos por responsable</h3>
          <p className="mb-4 text-xs text-slate-500">Requerimientos sin resolver asignados a cada persona, por etapa</p>
          {carga.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No hay requerimientos abiertos 🎉</p>
          ) : (
            <ul className="space-y-3">
              {carga.map((c) => (
                <li key={c.nombre}>
                  <button onClick={() => setAsignado(asignado === c.nombre ? "" : c.nombre)} className="w-full text-left">
                    <div className="flex justify-between text-xs">
                      <span className={clsx("truncate pr-2", asignado === c.nombre ? "font-semibold text-brand-600" : "text-slate-700")}>{c.nombre}</span>
                      <span className="font-semibold tabular-nums text-ink-900">{c.total}</span>
                    </div>
                    <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70" style={{ width: `${Math.max(8, (c.total / maxCarga) * 100)}%` }}>
                      {ETAPAS.filter((e) => c.porEtapa[e.key]).map((e) => (
                        <span key={e.key} className="h-full border-r-2 border-white/80 last:border-r-0" style={{ flex: c.porEtapa[e.key], background: e.color }} title={`${e.key}: ${c.porEtapa[e.key]}`} />
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-600">
            {ETAPAS.filter((e) => !CERRADAS.has(e.key)).map((e) => (
              <span key={e.key} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: e.color }} /> {e.key}
              </span>
            ))}
          </div>
        </section>

        {/* Por módulo */}
        <section className="card p-5">
          <h3 className="font-semibold text-ink-900">Requerimientos por módulo</h3>
          <p className="mb-4 text-xs text-slate-500">Abiertos frente a resueltos o cerrados</p>
          <ul className="space-y-3">
            {porModulo.map((m) => (
              <li key={m.nombre}>
                <button onClick={() => setModulo(modulo === m.nombre ? "" : m.nombre)} className="w-full text-left">
                  <div className="flex justify-between text-xs">
                    <span className={clsx("truncate pr-2", modulo === m.nombre ? "font-semibold text-brand-600" : "text-slate-700")}>{m.nombre}</span>
                    <span className="tabular-nums text-slate-500">
                      <b className="text-ink-900">{m.abiertos}</b> abiertos · {m.cerrados} cerrados
                    </span>
                  </div>
                  <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70" style={{ width: `${Math.max(8, (m.total / maxModulo) * 100)}%` }}>
                    {m.abiertos > 0 && <span className="h-full border-r-2 border-white/80" style={{ flex: m.abiertos, background: "#e0a100" }} />}
                    {m.cerrados > 0 && <span className="h-full" style={{ flex: m.cerrados, background: "#13a052" }} />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e0a100]" /> Abiertos</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#13a052]" /> Resueltos / cerrados</span>
          </div>
        </section>
      </div>

      {/* Tabla */}
      <section className="card overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-white/60 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID, título, módulo o persona…" className="input pl-9" />
          </div>
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} className="input lg:w-48">
            <option value="">Todos los módulos</option>
            {opciones("Modulo").map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={asignado} onChange={(e) => setAsignado(e.target.value)} className="input lg:w-52">
            <option value="">Todos los asignados</option>
            {opciones("Asignado_A").map((m) => <option key={m}>{m}</option>)}
          </select>
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="input lg:w-40">
            <option value="">Toda prioridad</option>
            {PRIORIDADES.filter((p) => items.some((r) => r.Prioridad.toLowerCase() === p)).map((p) => <option key={p} value={p}>{cap(p)}</option>)}
          </select>
          <button onClick={exportar} className="btn-ghost shrink-0">
            <Download className="h-4 w-4" /> CSV
          </button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/20 text-left text-xs uppercase text-slate-500">
              <tr>
                {th("ID", "ID", "pl-5")}
                <th className="px-3 py-2.5">Requerimiento</th>
                <th className="px-3 py-2.5">Etapa</th>
                {th("Prioridad", "Prioridad")}
                <th className="px-3 py-2.5">Asignado a</th>
                {th("Creado", "Creado")}
                {th("Dias", "Días", "pr-5 text-right")}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/60">
              {visibles.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No hay requerimientos con estos filtros.</td></tr>
              )}
              {visibles.map((r) => (
                <tr key={r.ID} onClick={() => setDetalle(r)} className="cursor-pointer transition-colors hover:bg-white/40">
                  <td className="py-3 pl-5 pr-3 font-mono text-xs text-slate-500">#{r.ID}</td>
                  <td className="max-w-md px-3 py-3">
                    <p className="line-clamp-2 font-medium text-ink-900">{r.Titulo}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.Modulo}{r.Impuesto && r.Impuesto !== r.Producto ? ` · ${r.Impuesto}` : ""}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={clsx("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1", etapaInfo(r.Etapa).chip)}>{r.Etapa}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold ring-1", PRIO_STYLE[r.Prioridad.toLowerCase()] ?? PRIO_STYLE.normal)}>{cap(r.Prioridad)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700">{r.Asignado_A || "Sin asignar"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fecha(r.Creado)}</td>
                  <td className={clsx("py-3 pl-3 pr-5 text-right tabular-nums", abierto(r) && dias(r) > 10 ? "font-semibold text-red-600" : "text-slate-600")}>{dias(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-white/60 px-5 py-2.5 text-[11px] text-slate-500">
          {visibles.length} de {items.length} requerimientos · Días en rojo: abiertos con más de 10 días hábiles
        </p>
      </section>

      {/* Detalle */}
      {detalle && (
        <Modal title={`Requerimiento #${detalle.ID}`} onClose={() => setDetalle(null)} wide>
          <h3 className="text-lg font-semibold leading-snug text-ink-900">{detalle.Titulo}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium ring-1", etapaInfo(detalle.Etapa).chip)}>{detalle.Etapa}</span>
            <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold ring-1", PRIO_STYLE[detalle.Prioridad.toLowerCase()] ?? PRIO_STYLE.normal)}>Prioridad {cap(detalle.Prioridad)}</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-white">{humanEstado(detalle.Estado)}</span>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["Módulo", detalle.Modulo],
              ["Impuesto", detalle.Impuesto],
              ["Cliente", detalle.Cliente],
              ["Producto", detalle.Producto],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label">{k}</dt>
                <dd className="text-ink-900">{v || "—"}</dd>
              </div>
            ))}
            <div>
              <dt className="label">Asignado a</dt>
              <dd className="flex items-center gap-1.5 text-ink-900"><User className="h-3.5 w-3.5 text-slate-400" /> {detalle.Asignado_A || "Sin asignar"}</dd>
            </div>
            <div>
              <dt className="label">Reportado por</dt>
              <dd className="flex items-center gap-1.5 text-ink-900"><UserPen className="h-3.5 w-3.5 text-slate-400" /> {detalle.Reportado_Por || "—"}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-2xl bg-white/40 p-4 ring-1 ring-white/70">
            <p className="label mb-3">Recorrido</p>
            <ol className="relative space-y-3 border-l border-white pl-5">
              {[
                ["Creado", detalle.Creado],
                ["Enviado a comité", detalle.Enviado_Comite],
                ["Inicio de desarrollo", detalle.Inicio_Desarrollo],
                ["Último QA", detalle.Ultimo_QA],
                ["Última transición", detalle.Ultima_Transicion],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <li key={k} className="relative text-sm">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white/70" />
                    <span className="font-medium text-ink-900">{k}</span> <span className="text-slate-500">· {fecha(v, true)}</span>
                  </li>
                ))}
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              {abierto(detalle) ? "Abierto hace" : "Resuelto en"} <b className="text-ink-900">{dias(detalle)} días hábiles</b> · actualizado {fecha(detalle.Actualizado, true)}
            </p>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={() => setDetalle(null)} className="btn-ghost">Cerrar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
