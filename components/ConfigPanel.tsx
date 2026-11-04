"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Check, DownloadCloud, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { TIPOS_CATALOGO, type ItemCatalogo, type TipoCatalogo } from "@/lib/catalogos";

type Uso = Record<TipoCatalogo, Record<string, number>>;
type Usados = Record<TipoCatalogo, string[]>;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

const ordenar = (a: ItemCatalogo, b: ItemCatalogo) =>
  (Number(a.Orden) || 0) - (Number(b.Orden) || 0) || a.Valor.localeCompare(b.Valor, "es");

export default function ConfigPanel({ initialItems, uso, usados }: { initialItems: ItemCatalogo[]; uso: Uso; usados: Usados }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [tipo, setTipo] = useState<TipoCatalogo>("modulo");
  const [nuevo, setNuevo] = useState({ Valor: "", Descripcion: "" });
  const [edit, setEdit] = useState<{ ID: string; Valor: string; Descripcion: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const meta = TIPOS_CATALOGO.find((t) => t.key === tipo)!;
  const lista = useMemo(() => items.filter((i) => i.Tipo === tipo).sort(ordenar), [items, tipo]);
  const usoTipo = uso[tipo] ?? {};
  const pendientesImportar = useMemo(() => {
    const ya = new Set(lista.map((i) => i.Valor.trim().toLowerCase()));
    return [...new Set([...(lista.length ? [] : meta.defaults), ...(usados[tipo] ?? [])])].filter((v) => v && !ya.has(v.toLowerCase()));
  }, [lista, meta, usados, tipo]);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };
  const conteo = (t: TipoCatalogo) => items.filter((i) => i.Tipo === t && i.Estado !== "Inactivo").length;

  async function crear(valores: string[], descripcion = "") {
    setBusy("crear");
    setError(null);
    try {
      const creados = await api<ItemCatalogo[]>("/api/config", {
        method: "POST",
        body: JSON.stringify({ Tipo: tipo, Valores: valores, Descripcion: descripcion }),
      });
      setItems((xs) => [...xs, ...creados]);
      setNuevo({ Valor: "", Descripcion: "" });
      notify(creados.length === 1 ? `"${creados[0].Valor}" agregado` : `${creados.length} elementos agregados`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, data: Partial<ItemCatalogo>) {
    const r = await api<ItemCatalogo>(`/api/config/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    setItems((xs) => xs.map((x) => (x.ID === id ? { ...x, ...r } : x)));
  }

  async function guardarEdicion() {
    if (!edit) return;
    setBusy(edit.ID);
    setError(null);
    try {
      await patch(edit.ID, { Valor: edit.Valor, Descripcion: edit.Descripcion });
      setEdit(null);
      notify("Cambios guardados");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleEstado(i: ItemCatalogo) {
    setBusy(i.ID);
    try {
      await patch(i.ID, { Estado: i.Estado === "Inactivo" ? "Activo" : "Inactivo" });
      router.refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    const destino = idx + dir;
    if (destino < 0 || destino >= lista.length) return;
    const nuevaLista = [...lista];
    [nuevaLista[idx], nuevaLista[destino]] = [nuevaLista[destino], nuevaLista[idx]];
    const cambios = nuevaLista.map((x, i) => ({ x, orden: String(i + 1) })).filter(({ x, orden }) => x.Orden !== orden);
    setItems((xs) => xs.map((x) => ({ ...x, Orden: cambios.find((c) => c.x.ID === x.ID)?.orden ?? x.Orden })));
    setBusy(lista[idx].ID);
    try {
      for (const c of cambios) await patch(c.x.ID, { Orden: c.orden });
      router.refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function eliminar(i: ItemCatalogo) {
    const usos = usoTipo[i.Valor.trim().toLowerCase()] ?? 0;
    const aviso = usos
      ? `\n\n"${i.Valor}" está en uso en ${usos} registro(s). Esos registros conservarán el texto, pero ya no aparecerá en la lista. Si solo quieres ocultarlo, usa "Desactivar".`
      : "";
    if (!confirm(`¿Eliminar "${i.Valor}" de ${meta.label}?${aviso}`)) return;
    setBusy(i.ID);
    try {
      await api(`/api/config/${i.ID}`, { method: "DELETE" });
      setItems((xs) => xs.filter((x) => x.ID !== i.ID));
      notify(`"${i.Valor}" eliminado`);
      router.refresh();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pestañas de catálogos */}
      <div className="inline-flex flex-wrap rounded-2xl border border-white/60 bg-white/30 p-1 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.7)] backdrop-blur-xl" role="tablist">
        {TIPOS_CATALOGO.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tipo === t.key}
            onClick={() => {
              setTipo(t.key);
              setEdit(null);
              setError(null);
            }}
            className={clsx(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
              tipo === t.key ? "bg-white/85 text-ink-900 shadow-sm" : "text-slate-600 hover:bg-white/50",
            )}
          >
            {t.label}
            <span className={clsx("rounded-full px-1.5 text-[11px] tabular-nums", tipo === t.key ? "bg-brand-50 text-brand-600" : "bg-white/60 text-slate-500")}>
              {conteo(t.key)}
            </span>
          </button>
        ))}
      </div>

      <section className="card overflow-hidden">
        <header className="border-b border-white/60 p-5">
          <h3 className="font-semibold text-ink-900">{meta.label}</h3>
          <p className="text-xs text-slate-500">{meta.desc}</p>
        </header>

        {/* Agregar */}
        <form
          className="flex flex-col gap-2 border-b border-white/60 bg-white/15 p-4 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (nuevo.Valor.trim()) crear([nuevo.Valor.trim()], nuevo.Descripcion.trim());
          }}
        >
          <input
            className="input sm:flex-1"
            placeholder={`Nuevo ${meta.singular}…`}
            value={nuevo.Valor}
            onChange={(e) => setNuevo((n) => ({ ...n, Valor: e.target.value }))}
            maxLength={120}
          />
          <input
            className="input sm:flex-1"
            placeholder={meta.campoDesc}
            value={nuevo.Descripcion}
            onChange={(e) => setNuevo((n) => ({ ...n, Descripcion: e.target.value }))}
            maxLength={200}
          />
          <button type="submit" className="btn-primary" disabled={!nuevo.Valor.trim() || busy === "crear"}>
            {busy === "crear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar
          </button>
        </form>
        {error && <p className="mx-4 mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        {/* Importar valores existentes / por defecto */}
        {pendientesImportar.length > 0 && (
          <div className="m-4 flex flex-col gap-3 rounded-2xl bg-brand-50/60 p-4 text-sm ring-1 ring-brand-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-ink-900">
                {lista.length === 0 && meta.defaults.length > 0
                  ? "Esta lista aún está vacía: la app usa los valores por defecto. Impórtalos para poder editarlos."
                  : lista.length === 0
                    ? "Estos valores ya aparecen en los registros. Impórtalos para empezar la lista."
                    : "Hay valores en uso que no están en la lista."}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {pendientesImportar.slice(0, 6).join(" · ")}
                {pendientesImportar.length > 6 && ` · y ${pendientesImportar.length - 6} más`}
              </p>
            </div>
            <button onClick={() => crear(pendientesImportar)} disabled={busy === "crear"} className="btn-ghost shrink-0">
              <DownloadCloud className="h-4 w-4" /> Importar {pendientesImportar.length}
            </button>
          </div>
        )}

        {/* Lista */}
        {lista.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Aún no hay elementos. Agrega el primero o importa los existentes.</p>
        ) : (
          <ul className="divide-y divide-white/60">
            {lista.map((i, idx) => {
              const usos = usoTipo[i.Valor.trim().toLowerCase()] ?? 0;
              const editando = edit?.ID === i.ID;
              const inactivo = i.Estado === "Inactivo";
              return (
                <li key={i.ID} className={clsx("flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-white/25 sm:flex-row sm:items-center", inactivo && "opacity-55")}>
                  <div className="flex shrink-0 gap-0.5">
                    <button onClick={() => mover(idx, -1)} disabled={idx === 0 || !!busy} className="rounded-lg p-1 text-slate-400 hover:bg-white/70 hover:text-ink-800 disabled:opacity-30" aria-label="Subir">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button onClick={() => mover(idx, 1)} disabled={idx === lista.length - 1 || !!busy} className="rounded-lg p-1 text-slate-400 hover:bg-white/70 hover:text-ink-800 disabled:opacity-30" aria-label="Bajar">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  {editando ? (
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                      <input className="input sm:flex-1" value={edit.Valor} onChange={(e) => setEdit({ ...edit, Valor: e.target.value })} autoFocus />
                      <input className="input sm:flex-1" value={edit.Descripcion} placeholder={meta.campoDesc} onChange={(e) => setEdit({ ...edit, Descripcion: e.target.value })} />
                      <div className="flex gap-1">
                        <button onClick={guardarEdicion} disabled={!edit.Valor.trim() || busy === i.ID} className="btn-primary px-3" aria-label="Guardar">
                          {busy === i.ID ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEdit(null)} className="btn-ghost px-3" aria-label="Cancelar">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{i.Valor}</p>
                      {i.Descripcion && <p className="truncate text-xs text-slate-500">{i.Descripcion}</p>}
                    </div>
                  )}

                  {!editando && (
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={clsx("rounded-full px-2 py-0.5 text-[11px] tabular-nums ring-1", usos ? "bg-brand-50/80 text-brand-600 ring-brand-100" : "bg-white/50 text-slate-400 ring-white/70")}>
                        {usos ? `En uso: ${usos}` : "Sin uso"}
                      </span>
                      <button
                        onClick={() => toggleEstado(i)}
                        disabled={busy === i.ID}
                        role="switch"
                        aria-checked={!inactivo}
                        title={inactivo ? "Activar (aparece en los desplegables)" : "Desactivar (se oculta de los desplegables)"}
                        className="flex items-center gap-2 text-xs text-slate-600"
                      >
                        <span className={clsx("relative h-5 w-9 rounded-full transition-colors", inactivo ? "bg-slate-300" : "bg-gov-500")}>
                          <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", inactivo ? "left-0.5" : "left-[18px]")} />
                        </span>
                      </button>
                      <button onClick={() => setEdit({ ID: i.ID, Valor: i.Valor, Descripcion: i.Descripcion ?? "" })} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70 hover:text-ink-800" aria-label={`Editar ${i.Valor}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => eliminar(i)} disabled={busy === i.ID} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${i.Valor}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="border-t border-white/60 px-5 py-3 text-[11px] text-slate-500">
          Al renombrar un elemento, los registros existentes conservan el nombre anterior. Desactivar lo oculta de los desplegables sin borrarlo.
        </p>
      </section>

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-2xl border glass-dark animate-modal-in px-4 py-3 text-sm text-white">{toast}</div>}
    </div>
  );
}
