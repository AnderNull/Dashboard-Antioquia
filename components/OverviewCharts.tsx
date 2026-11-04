"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, BarChart3 } from "lucide-react";

export type ModuloRow = {
  modulo: string;
  "Por Hacer": number;
  "En Progreso": number;
  "En Revisión": number;
  Completado: number;
  total: number;
  avance: number;
  bloqueadas: number;
};

// Paleta categórica validada (orden fijo; el color sigue al estado, nunca al rango)
const SERIES = [
  { key: "Completado", color: "#2a78d6" },
  { key: "En Revisión", color: "#eb6834" },
  { key: "En Progreso", color: "#1baf7a" },
  { key: "Por Hacer", color: "#eda100" },
] as const;

const AXIS = { fontSize: 12, fill: "#52514e" };
const GRID = "#e7e6e2";

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-xs">
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

export default function OverviewCharts({ modulos, porTipo }: { modulos: ModuloRow[]; porTipo: { tipo: string; abiertos: number }[] }) {
  const [tabla, setTabla] = useState(false);
  const alto = Math.max(220, modulos.length * 44 + 60);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="card p-5 xl:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink-900">Avance por módulo tributario</h3>
            <p className="text-xs text-slate-500">Tareas por estado en cada módulo de TAXATION SMART</p>
          </div>
          <button onClick={() => setTabla((v) => !v)} className="btn-ghost px-3 py-1.5 text-xs" aria-pressed={tabla}>
            {tabla ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
            {tabla ? "Ver gráfico" : "Ver tabla"}
          </button>
        </div>
        {tabla ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Módulo</th>
                  {SERIES.map((s) => <th key={s.key} className="px-2 py-2 text-right">{s.key}</th>)}
                  <th className="px-2 py-2 text-right">Bloqueadas</th>
                  <th className="py-2 pl-2 text-right">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 tabular-nums">
                {modulos.map((m) => (
                  <tr key={m.modulo}>
                    <td className="py-2 pr-3 font-medium text-ink-900">{m.modulo}</td>
                    {SERIES.map((s) => <td key={s.key} className="px-2 py-2 text-right">{m[s.key]}</td>)}
                    <td className="px-2 py-2 text-right">{m.bloqueadas}</td>
                    <td className="py-2 pl-2 text-right font-semibold">{m.avance}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={alto}>
            <BarChart data={modulos} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="modulo" width={150} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(255,255,255,0.45)" }} />
              <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#52514e" }} />
              {SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="estado"
                  fill={s.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  radius={i === SERIES.length - 1 ? [0, 4, 4, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="space-y-6">
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900">% de completitud por módulo</h3>
          <p className="mb-4 text-xs text-slate-500">Tareas completadas / total del módulo</p>
          <ul className="space-y-3">
            {[...modulos].sort((a, b) => b.avance - a.avance).map((m) => (
              <li key={m.modulo}>
                <div className="flex justify-between text-xs">
                  <span className="truncate pr-2 text-slate-700">{m.modulo}</span>
                  <span className="tabular-nums font-semibold text-ink-900">{m.avance}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/60 ring-1 ring-white/70">
                  <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${m.avance}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-ink-900">Bloqueos abiertos por tipo</h3>
          <p className="mb-2 text-xs text-slate-500">Según Bloqueos_Log (abiertos + en gestión)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={porTipo} margin={{ top: 16, left: -24, right: 8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="tipo" tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(255,255,255,0.45)" }} />
              <Bar dataKey="abiertos" name="Bloqueos abiertos" fill="#e34948" radius={[4, 4, 0, 0]} maxBarSize={36} label={{ position: "top", fontSize: 11, fill: "#0b0b0b" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
