"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Check, ListChecks, Plus, X } from "lucide-react";
import { leerChecklist, progresoChecklist, serializarChecklist, type ItemChecklist } from "@/lib/checklist";

/**
 * Lista de comprobación editable: agregar tantos elementos como se necesiten,
 * marcarlos como hechos, editarlos, reordenarlos y eliminarlos.
 * Trabaja sobre el texto serializado de la columna Checklist.
 */
export default function ChecklistEditor({
  value,
  progreso,
  onChange,
  disabled,
}: {
  value?: string;
  progreso?: string;
  onChange: (checklist: string, progreso: string) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState<ItemChecklist[]>(() => leerChecklist(value, progreso));
  const [nuevo, setNuevo] = useState("");
  const nuevoRef = useRef<HTMLInputElement>(null);

  const actualizar = (next: ItemChecklist[]) => {
    setItems(next);
    onChange(serializarChecklist(next), progresoChecklist(next));
  };
  const agregar = () => {
    const lineas = nuevo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lineas.length) return;
    actualizar([...items, ...lineas.map((texto) => ({ texto, hecho: false }))]);
    setNuevo("");
    nuevoRef.current?.focus();
  };
  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    actualizar(next);
  };

  const hechos = items.filter((i) => i.hecho).length;
  const pct = items.length ? Math.round((hechos / items.length) * 100) : 0;

  return (
    <div className="rounded-2xl bg-white/40 p-4 ring-1 ring-white/70">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <ListChecks className="h-3.5 w-3.5" /> Lista de tareas
        </p>
        {items.length > 0 && (
          <span className={clsx("text-xs font-semibold tabular-nums", hechos === items.length ? "text-gov-600" : "text-brand-600")}>
            {hechos}/{items.length} · {pct}%
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-white">
          <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-gov-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="group flex items-center gap-2 rounded-xl bg-white/50 px-2 py-1.5 ring-1 ring-white/80 transition-colors hover:bg-white/75">
            <button
              type="button"
              role="checkbox"
              aria-checked={it.hecho}
              aria-label={it.hecho ? `Marcar "${it.texto}" como pendiente` : `Marcar "${it.texto}" como hecho`}
              disabled={disabled}
              onClick={() => actualizar(items.map((x, k) => (k === i ? { ...x, hecho: !x.hecho } : x)))}
              className={clsx(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                it.hecho ? "border-gov-500 bg-gov-500 text-white" : "border-slate-300 bg-white hover:border-brand-500",
              )}
            >
              {it.hecho && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <input
              value={it.texto}
              disabled={disabled}
              onChange={(e) => actualizar(items.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)))}
              onBlur={() => !it.texto.trim() && actualizar(items.filter((_, k) => k !== i))}
              className={clsx(
                "min-w-0 flex-1 bg-transparent text-sm outline-none",
                it.hecho ? "text-slate-400 line-through" : "text-ink-900",
              )}
              aria-label={`Elemento ${i + 1}`}
            />
            {!disabled && (
              <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-ink-800 disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === items.length - 1} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-ink-800 disabled:opacity-30" aria-label="Bajar">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => actualizar(items.filter((_, k) => k !== i))} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar "${it.texto}"`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!disabled && (
        <div className={clsx("flex gap-2", items.length > 0 && "mt-2")}>
          <input
            ref={nuevoRef}
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
            onPaste={(e) => {
              // Pegar varias líneas crea un elemento por línea
              const txt = e.clipboardData.getData("text");
              if (txt.includes("\n")) {
                e.preventDefault();
                const lineas = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                actualizar([...items, ...lineas.map((texto) => ({ texto, hecho: false }))]);
              }
            }}
            placeholder={items.length ? "Agregar otro elemento…" : "Escribe un elemento y presiona Enter"}
            className="input py-1.5"
            aria-label="Nuevo elemento de la lista"
          />
          <button type="button" onClick={agregar} disabled={!nuevo.trim()} className="btn-ghost shrink-0 px-3 py-1.5">
            <Plus className="h-4 w-4" /> Agregar
          </button>
        </div>
      )}
      {items.length === 0 && disabled && <p className="text-xs text-slate-400">Sin elementos.</p>}
    </div>
  );
}
