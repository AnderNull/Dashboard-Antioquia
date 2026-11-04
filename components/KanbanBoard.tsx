"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertOctagon, CalendarDays, Filter, Loader2, Lock, Plus, Search, Trash2, User } from "lucide-react";
import { Modal } from "./ui";
import {
  ESTADOS_BLOQUEO,
  ESTADOS_TAREA,
  MODULOS_TAXATION,
  PRIORIDADES,
  TIPOS_BLOQUEO,
  type Bloqueo,
  type EstadoTarea,
  type Tarea,
  type TipoBloqueo,
} from "@/lib/types";

const COLUMNAS: { estado: EstadoTarea; accent: string }[] = [
  { estado: "Por Hacer", accent: "bg-slate-400" },
  { estado: "En Progreso", accent: "bg-sky-500" },
  { estado: "En Revisión", accent: "bg-violet-500" },
  { estado: "Completado", accent: "bg-brand-600" },
];

const PRIORIDAD_STYLE: Record<string, string> = {
  Alta: "bg-red-50 text-red-700 ring-red-200",
  Media: "bg-amber-50 text-amber-700 ring-amber-200",
  Baja: "bg-white/60 text-slate-600 ring-slate-200",
};

type Draft = Partial<Tarea> & { Tipo_Bloqueo?: TipoBloqueo };

const EMPTY: Draft = {
  Proyecto: "TAXATION SMART",
  "Requerimiento/Tarea": "",
  Modulo_Taxation: "",
  Estado: "Por Hacer",
  Prioridad: "Media",
  Responsable: "",
  Fecha_Inicio: "",
  Fecha_Entrega: "",
  Bloqueado: "No",
  Detalle_Bloqueo: "",
  Tipo_Bloqueo: "Técnico",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

const isOverdue = (t: Tarea) => t.Estado !== "Completado" && !!t.Fecha_Entrega && t.Fecha_Entrega < new Date().toISOString().slice(0, 10);

export default function KanbanBoard({
  initialTareas,
  initialBloqueos,
  canEdit,
  canDelete,
}: {
  initialTareas: Tarea[];
  initialBloqueos: Bloqueo[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [tareas, setTareas] = useState(initialTareas);
  const [bloqueos, setBloqueos] = useState(initialBloqueos);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<EstadoTarea | null>(null);
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState("");
  const [soloBloq, setSoloBloq] = useState(false);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const bloqueoAbierto = useMemo(() => {
    const map = new Map<string, Bloqueo>();
    for (const b of bloqueos) if (b.Estado !== "Resuelto") map.set(b.Tarea_ID, b);
    return map;
  }, [bloqueos]);

  const modulos = useMemo(
    () => [...new Set([...MODULOS_TAXATION, ...tareas.map((t) => t.Modulo_Taxation).filter(Boolean)])],
    [tareas],
  );

  const visibles = tareas.filter((t) => {
    if (modulo && t.Modulo_Taxation !== modulo) return false;
    if (soloBloq && t.Bloqueado !== "Sí") return false;
    if (q) {
      const s = q.toLowerCase();
      return [t["Requerimiento/Tarea"], t.Responsable, t.ID, t.Modulo_Taxation].some((v) => v?.toLowerCase().includes(s));
    }
    return true;
  });

  async function refreshBloqueos() {
    try {
      setBloqueos(await api<Bloqueo[]>("/api/bloqueos"));
    } catch {
      /* silencioso */
    }
  }

  async function moveTo(id: string, estado: EstadoTarea) {
    const prev = tareas;
    const t = prev.find((x) => x.ID === id);
    if (!t || t.Estado === estado) return;
    setTareas(prev.map((x) => (x.ID === id ? { ...x, Estado: estado } : x)));
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ Estado: estado }) });
      router.refresh();
    } catch (e) {
      setTareas(prev);
      notify(`No se pudo mover la tarea: ${(e as Error).message}`);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...draft };
      delete (payload as Partial<Tarea>).Fecha_Creacion;
      delete (payload as Partial<Tarea>).ID;
      if (draft.ID) {
        const updated = await api<Tarea>(`/api/tasks/${draft.ID}`, { method: "PATCH", body: JSON.stringify(payload) });
        setTareas((ts) => ts.map((t) => (t.ID === updated.ID ? (updated as Tarea) : t)));
        notify("Tarea actualizada");
      } else {
        const created = await api<Tarea>("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
        setTareas((ts) => [...ts, created]);
        notify("Tarea creada");
      }
      setDraft(null);
      await refreshBloqueos();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft?.ID || !confirm(`¿Eliminar definitivamente la tarea ${draft.ID}?`)) return;
    setSaving(true);
    try {
      await api(`/api/tasks/${draft.ID}`, { method: "DELETE" });
      setTareas((ts) => ts.filter((t) => t.ID !== draft.ID));
      setDraft(null);
      notify("Tarea eliminada");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstadoBloqueo(b: Bloqueo, Estado: Bloqueo["Estado"]) {
    try {
      const r = await api<{ bloqueo: Bloqueo; tareaDesbloqueada: boolean }>(`/api/bloqueos/${b.ID}`, {
        method: "PATCH",
        body: JSON.stringify({ Estado }),
      });
      setBloqueos((bs) => bs.map((x) => (x.ID === b.ID ? r.bloqueo : x)));
      if (r.tareaDesbloqueada) {
        setTareas((ts) => ts.map((t) => (t.ID === b.Tarea_ID ? { ...t, Bloqueado: "No", Detalle_Bloqueo: "" } : t)));
        notify(`Bloqueo resuelto · tarea ${b.Tarea_ID} desbloqueada`);
      }
      router.refresh();
    } catch (e) {
      notify((e as Error).message);
    }
  }

  const abiertos = bloqueos.filter((b) => b.Estado !== "Resuelto");
  const set = (k: keyof Draft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 z-10 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por tarea, responsable o ID…" className="input pl-9" />
        </div>
        <select value={modulo} onChange={(e) => setModulo(e.target.value)} className="input lg:w-56">
          <option value="">Todos los módulos</option>
          {modulos.map((m) => <option key={m}>{m}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/80 bg-white/30 px-3 py-2 text-sm text-slate-700 backdrop-blur-xl">
          <input type="checkbox" checked={soloBloq} onChange={(e) => setSoloBloq(e.target.checked)} className="accent-red-600" />
          <Filter className="h-3.5 w-3.5" /> Solo bloqueadas
        </label>
        {canEdit && (
          <button onClick={() => { setError(null); setDraft({ ...EMPTY }); }} className="btn-primary">
            <Plus className="h-4 w-4" /> Nueva tarea
          </button>
        )}
      </div>

      {/* Tablero */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map(({ estado, accent }) => {
          const items = visibles.filter((t) => t.Estado === estado);
          return (
            <section
              key={estado}
              onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(estado); } }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) moveTo(id, estado); }}
              className={clsx(
                "flex min-h-[320px] flex-col rounded-2xl border bg-white/12 p-3 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6)] backdrop-blur-2xl transition",
                dragOver === estado ? "border-brand-500/70 bg-brand-50/60" : "border-white/50",
              )}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                  <span className={clsx("h-2.5 w-2.5 rounded-full", accent)} /> {estado}
                </h3>
                <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-3">
                {items.map((t) => {
                  const bloq = t.Bloqueado === "Sí";
                  const log = bloqueoAbierto.get(t.ID);
                  return (
                    <article
                      key={t.ID}
                      draggable={canEdit}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.ID)}
                      onClick={() => { setError(null); setDraft({ ...t, Tipo_Bloqueo: log?.Tipo_Bloqueo ?? "Técnico" }); }}
                      className={clsx(
                        "cursor-pointer rounded-xl border bg-white/50 p-3.5 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.9),0_2px_8px_-2px_rgb(15_27_45/0.08)] backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-lg",
                        bloq ? "border-red-300/80 ring-1 ring-red-200/70" : "border-white/80",
                        canEdit && "active:cursor-grabbing",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono text-slate-400">{t.ID}</span>
                        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", PRIORIDAD_STYLE[t.Prioridad] ?? PRIORIDAD_STYLE.Baja)}>
                          {t.Prioridad || "—"}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug text-ink-900">{t["Requerimiento/Tarea"]}</p>
                      {t.Modulo_Taxation && (
                        <span className="mt-2 inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">{t.Modulo_Taxation}</span>
                      )}
                      {bloq && (
                        <div className="mt-2.5 rounded-lg border border-red-200/80 bg-red-50/70 p-2 text-xs text-red-800">
                          <p className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
                            <Lock className="h-3 w-3" /> Bloqueada{log ? ` · ${log.Tipo_Bloqueo}` : ""}
                          </p>
                          <p className="mt-0.5 line-clamp-3">{t.Detalle_Bloqueo || log?.Descripcion_Bloqueo || "Sin detalle registrado"}</p>
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 truncate"><User className="h-3 w-3" /> {t.Responsable || "Sin asignar"}</span>
                        {t.Fecha_Entrega && (
                          <span className={clsx("flex items-center gap-1", isOverdue(t) && "font-semibold text-red-600")}>
                            <CalendarDays className="h-3 w-3" /> {t.Fecha_Entrega}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
                {items.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Sin tareas</p>}
              </div>
            </section>
          );
        })}
      </div>

      {/* Bloqueos */}
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-white/60 p-5">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-ink-900">
              <AlertOctagon className="h-4 w-4 text-red-600" /> Registro de bloqueos activos
            </h3>
            <p className="text-xs text-slate-500">Pestaña Bloqueos_Log · {abiertos.length} abiertos / en gestión</p>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/20 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2.5">ID</th>
                <th className="px-3 py-2.5">Tarea</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Descripción</th>
                <th className="px-3 py-2.5">Registro</th>
                <th className="px-5 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/60">
              {abiertos.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No hay bloqueos activos 🎉</td></tr>
              )}
              {abiertos.map((b) => (
                <tr key={b.ID}>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{b.ID}</td>
                  <td className="px-3 py-3 font-mono text-xs">{b.Tarea_ID}</td>
                  <td className="px-3 py-3">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", b.Tipo_Bloqueo === "Cliente/Gobernación" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
                      {b.Tipo_Bloqueo}
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-3 text-slate-700">{b.Descripcion_Bloqueo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{b.Fecha_Registro}</td>
                  <td className="px-5 py-3">
                    <select
                      disabled={!canEdit}
                      value={b.Estado}
                      onChange={(e) => cambiarEstadoBloqueo(b, e.target.value as Bloqueo["Estado"])}
                      className="input py-1 text-xs"
                    >
                      {ESTADOS_BLOQUEO.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal crear/editar */}
      {draft && (
        <Modal title={draft.ID ? `Tarea ${draft.ID}` : "Nueva tarea"} onClose={() => setDraft(null)} wide>
          <fieldset disabled={!canEdit || saving} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Requerimiento / Tarea *</label>
              <textarea rows={3} className="input" value={draft["Requerimiento/Tarea"] ?? ""} onChange={(e) => set("Requerimiento/Tarea", e.target.value)} />
            </div>
            <div>
              <label className="label">Módulo Taxation *</label>
              <input list="modulos" className="input" value={draft.Modulo_Taxation ?? ""} onChange={(e) => set("Modulo_Taxation", e.target.value)} />
              <datalist id="modulos">{modulos.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div>
              <label className="label">Responsable</label>
              <input className="input" value={draft.Responsable ?? ""} onChange={(e) => set("Responsable", e.target.value)} />
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={draft.Estado} onChange={(e) => set("Estado", e.target.value)}>
                {ESTADOS_TAREA.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridad</label>
              <select className="input" value={draft.Prioridad} onChange={(e) => set("Prioridad", e.target.value)}>
                {PRIORIDADES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha inicio</label>
              <input type="date" className="input" value={draft.Fecha_Inicio ?? ""} onChange={(e) => set("Fecha_Inicio", e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha entrega</label>
              <input type="date" className="input" value={draft.Fecha_Entrega ?? ""} onChange={(e) => set("Fecha_Entrega", e.target.value)} />
            </div>
            <div className="sm:col-span-2 rounded-xl border border-red-200/70 bg-red-50/40 p-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-800">
                <input type="checkbox" className="accent-red-600" checked={draft.Bloqueado === "Sí"} onChange={(e) => set("Bloqueado", e.target.checked ? "Sí" : "No")} />
                <Lock className="h-4 w-4" /> Tarea bloqueada
              </label>
              {draft.Bloqueado === "Sí" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Tipo de bloqueo</label>
                    <select className="input" value={draft.Tipo_Bloqueo} onChange={(e) => set("Tipo_Bloqueo", e.target.value)}>
                      {TIPOS_BLOQUEO.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Causa / detalle del bloqueo *</label>
                    <input className="input" value={draft.Detalle_Bloqueo ?? ""} onChange={(e) => set("Detalle_Bloqueo", e.target.value)} placeholder="Ej.: Pendiente respuesta de la Gobernación sobre tarifas 2026" />
                  </div>
                </div>
              )}
            </div>
          </fieldset>
          {draft.Fecha_Creacion && <p className="mt-3 text-xs text-slate-400">Creada el {draft.Fecha_Creacion}</p>}
          {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex items-center justify-between gap-2">
            <div>
              {draft.ID && canDelete && (
                <button onClick={remove} disabled={saving} className="btn-danger">
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDraft(null)} className="btn-ghost">{canEdit ? "Cancelar" : "Cerrar"}</button>
              {canEdit && (
                <button
                  onClick={save}
                  disabled={saving || !draft["Requerimiento/Tarea"]?.trim() || !draft.Modulo_Taxation?.trim() || (draft.Bloqueado === "Sí" && !draft.Detalle_Bloqueo?.trim())}
                  className="btn-primary"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border glass-dark animate-modal-in px-4 py-3 text-sm text-white">{toast}</div>
      )}
    </div>
  );
}
