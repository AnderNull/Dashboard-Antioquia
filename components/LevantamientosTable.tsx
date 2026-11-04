"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowUpDown, Download, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Modal } from "./ui";
import { ESTADOS_APROBACION, IMPACTOS, MODULOS_TAXATION, type Levantamiento } from "@/lib/types";

const ESTADO_STYLE: Record<string, string> = {
  Pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
  "En Revisión": "bg-sky-50 text-sky-700 ring-sky-200",
  Aprobado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rechazado: "bg-red-50 text-red-700 ring-red-200",
};

const EMPTY: Partial<Levantamiento> = {
  Codigo_Requerimiento: "",
  Descripcion_Gobernacion: "",
  Modulo_Afectado: "",
  Impacto_Tributario: "Medio",
  Estado_Aprobacion: "Pendiente",
  Fecha_Levantamiento: new Date().toISOString().slice(0, 10),
};

type SortKey = keyof Levantamiento;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

function toCsv(rows: Levantamiento[]) {
  const cols: (keyof Levantamiento)[] = ["ID", "Codigo_Requerimiento", "Descripcion_Gobernacion", "Modulo_Afectado", "Impacto_Tributario", "Estado_Aprobacion", "Fecha_Levantamiento"];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function LevantamientosTable({
  initial,
  canCreate,
  canEdit,
  canDelete,
}: {
  initial: Levantamiento[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "Fecha_Levantamiento", dir: -1 });
  const [draft, setDraft] = useState<Partial<Levantamiento> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows
      .filter((r) => (!estado || r.Estado_Aprobacion === estado))
      .filter((r) => !s || Object.values(r).some((v) => String(v).toLowerCase().includes(s)))
      .sort((a, b) => String(a[sort.key] ?? "").localeCompare(String(b[sort.key] ?? ""), "es", { numeric: true }) * sort.dir);
  }, [rows, q, estado, sort]);

  const resumen = ESTADOS_APROBACION.map((e) => ({ e, n: rows.filter((r) => r.Estado_Aprobacion === e).length }));

  const th = (key: SortKey, label: string) => (
    <th className="px-3 py-2.5">
      <button
        className="flex items-center gap-1 uppercase hover:text-ink-900"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {label} <ArrowUpDown className={clsx("h-3 w-3", sort.key === key ? "text-brand-600" : "text-slate-300")} />
      </button>
    </th>
  );

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const { ID, ...payload } = draft;
      if (ID) {
        const u = await api<Levantamiento>(`/api/levantamientos/${ID}`, { method: "PATCH", body: JSON.stringify(payload) });
        setRows((rs) => rs.map((r) => (r.ID === ID ? u : r)));
      } else {
        const c = await api<Levantamiento>("/api/levantamientos", { method: "POST", body: JSON.stringify(payload) });
        setRows((rs) => [c, ...rs]);
      }
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function quickEstado(r: Levantamiento, Estado_Aprobacion: string) {
    const prev = rows;
    setRows((rs) => rs.map((x) => (x.ID === r.ID ? { ...x, Estado_Aprobacion } : x)));
    try {
      await api(`/api/levantamientos/${r.ID}`, { method: "PATCH", body: JSON.stringify({ Estado_Aprobacion }) });
    } catch (e) {
      setRows(prev);
      alert((e as Error).message);
    }
  }

  async function remove(r: Levantamiento) {
    if (!confirm(`¿Eliminar el levantamiento ${r.Codigo_Requerimiento}?`)) return;
    try {
      await api(`/api/levantamientos/${r.ID}`, { method: "DELETE" });
      setRows((rs) => rs.filter((x) => x.ID !== r.ID));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function exportCsv() {
    const blob = new Blob(["﻿" + toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `levantamientos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const set = (k: keyof Levantamiento, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {resumen.map(({ e, n }) => (
          <button
            key={e}
            onClick={() => setEstado((cur) => (cur === e ? "" : e))}
            className={clsx("card p-4 text-left transition hover:shadow-md", estado === e && "ring-2 ring-brand-500")}
          >
            <p className="text-xs font-medium text-slate-500">{e}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{n}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar código, descripción, módulo…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS_APROBACION.map((e) => <option key={e}>{e}</option>)}
        </select>
        <button onClick={exportCsv} className="btn-ghost"><Download className="h-4 w-4" /> CSV</button>
        {canCreate && (
          <button onClick={() => { setError(null); setDraft({ ...EMPTY }); }} className="btn-primary">
            <Plus className="h-4 w-4" /> Nuevo levantamiento
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-white/40 text-left text-xs text-slate-500">
            <tr>
              {th("Codigo_Requerimiento", "Código")}
              {th("Descripcion_Gobernacion", "Descripción")}
              {th("Modulo_Afectado", "Módulo")}
              {th("Impacto_Tributario", "Impacto")}
              {th("Estado_Aprobacion", "Aprobación")}
              {th("Fecha_Levantamiento", "Fecha")}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/60">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-400">Sin levantamientos que coincidan</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.ID} className="transition hover:bg-white/50">
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-ink-900">{r.Codigo_Requerimiento}</td>
                <td className="max-w-md px-3 py-3 text-slate-700"><p className="line-clamp-2">{r.Descripcion_Gobernacion}</p></td>
                <td className="px-3 py-3"><span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs text-sky-700">{r.Modulo_Afectado}</span></td>
                <td className="px-3 py-3 text-slate-700">{r.Impacto_Tributario}</td>
                <td className="px-3 py-3">
                  {canEdit ? (
                    <select
                      value={r.Estado_Aprobacion}
                      onChange={(e) => quickEstado(r, e.target.value)}
                      className={clsx("rounded-full border-0 px-2 py-1 text-xs font-semibold ring-1", ESTADO_STYLE[r.Estado_Aprobacion] ?? "bg-slate-50 ring-slate-200")}
                    >
                      {[...new Set([...ESTADOS_APROBACION, r.Estado_Aprobacion])].map((e) => <option key={e}>{e}</option>)}
                    </select>
                  ) : (
                    <span className={clsx("rounded-full px-2 py-1 text-xs font-semibold ring-1", ESTADO_STYLE[r.Estado_Aprobacion] ?? "bg-slate-50 ring-slate-200")}>
                      {r.Estado_Aprobacion || "—"}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{r.Fecha_Levantamiento}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {canEdit && (
                    <button onClick={() => { setError(null); setDraft({ ...r }); }} className="rounded p-1.5 text-slate-400 hover:bg-white/70 hover:text-slate-700" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => remove(r)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <Modal title={draft.ID ? `Editar ${draft.Codigo_Requerimiento}` : "Nuevo levantamiento"} onClose={() => setDraft(null)} wide>
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Código requerimiento *</label>
              <input className="input" value={draft.Codigo_Requerimiento ?? ""} onChange={(e) => set("Codigo_Requerimiento", e.target.value)} placeholder="REQ-GOB-001" />
            </div>
            <div>
              <label className="label">Fecha levantamiento</label>
              <input type="date" className="input" value={draft.Fecha_Levantamiento ?? ""} onChange={(e) => set("Fecha_Levantamiento", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descripción de la Gobernación *</label>
              <textarea rows={4} className="input" value={draft.Descripcion_Gobernacion ?? ""} onChange={(e) => set("Descripcion_Gobernacion", e.target.value)} />
            </div>
            <div>
              <label className="label">Módulo afectado *</label>
              <input list="mods-lev" className="input" value={draft.Modulo_Afectado ?? ""} onChange={(e) => set("Modulo_Afectado", e.target.value)} />
              <datalist id="mods-lev">{MODULOS_TAXATION.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div>
              <label className="label">Impacto tributario</label>
              <input list="impactos" className="input" value={draft.Impacto_Tributario ?? ""} onChange={(e) => set("Impacto_Tributario", e.target.value)} />
              <datalist id="impactos">{IMPACTOS.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            {canEdit && (
              <div>
                <label className="label">Estado de aprobación</label>
                <select className="input" value={draft.Estado_Aprobacion} onChange={(e) => set("Estado_Aprobacion", e.target.value)}>
                  {ESTADOS_APROBACION.map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
            )}
          </fieldset>
          {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setDraft(null)} className="btn-ghost">Cancelar</button>
            <button
              onClick={save}
              disabled={saving || !draft.Codigo_Requerimiento?.trim() || !draft.Descripcion_Gobernacion?.trim() || !draft.Modulo_Afectado?.trim()}
              className="btn-primary"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
