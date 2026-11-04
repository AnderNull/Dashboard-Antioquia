"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Activity, BrainCircuit, ClipboardList, KanbanSquare, Landmark, LayoutDashboard, Loader2, LogOut, Menu, UserCog, X } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/metricas", label: "Métricas en vivo", icon: Activity },
  { href: "/dashboard/tasks", label: "Kanban y Bloqueos", icon: KanbanSquare },
  { href: "/dashboard/levantamientos", label: "Levantamientos", icon: ClipboardList },
  { href: "/dashboard/analytics", label: "Analítica IA", icon: BrainCircuit },
];
const NAV_ADMIN = [{ href: "/dashboard/admin", label: "Usuarios y permisos", icon: UserCog }];

const ROLE_STYLE: Record<string, string> = {
  Admin: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  Desarrollador: "bg-sky-400/15 text-sky-300 ring-sky-400/30",
  Gobernacion: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
};

const ROLE_LABEL: Record<string, string> = { Gobernacion: "Gobernación" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default function Sidebar({
  user,
  logoutAction,
}: {
  user: { name: string; email: string; role: string; permisos: string[] };
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Sección elegida: se resalta al instante, antes de que termine de cargar
  const [pendiente, setPendiente] = useState<string | null>(null);
  useEffect(() => setPendiente(null), [pathname]);
  const actual = pendiente ?? pathname;

  return (
    <>
      {/* Barra de progreso mientras carga la nueva sección */}
      {pendiente && (
        <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" role="progressbar" aria-label="Cargando sección">
          <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-brand-500 via-series-1 to-brand-500" />
        </div>
      )}
      {/* Barra superior móvil */}
      <header className="fixed inset-x-2 top-2 z-30 flex h-14 items-center justify-between rounded-2xl border glass-dark px-4 text-white lg:hidden">
        <span className="font-semibold">
          TAXATION <span className="text-emerald-300">SMART</span>
        </span>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && <div className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm animate-fade-in lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={clsx(
          "fixed inset-y-2 left-2 z-50 flex w-72 flex-col overflow-hidden rounded-3xl border glass-dark text-slate-100 transition-transform duration-300 lg:sticky lg:top-3 lg:m-3 lg:h-[calc(100vh-1.5rem)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-white">
                TAXATION <span className="text-emerald-300">SMART</span>
              </p>
              <p className="text-xs text-slate-200">Gobernación de Antioquia</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10 lg:hidden" aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {[
            { titulo: "Gestión del proyecto", items: NAV },
            ...(user.permisos.includes("usuarios.administrar") ? [{ titulo: "Administración", items: NAV_ADMIN }] : []),
          ].map(({ titulo, items }) => (
            <div key={titulo} className="space-y-1 pb-4">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">{titulo}</p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = href === "/dashboard" ? actual === href : actual.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch
                    onClick={(e) => {
                      setOpen(false);
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && href !== pathname) setPendiente(href);
                    }}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-100 active:scale-[0.98]",
                      active ? "bg-white/12 text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.12)] ring-1 ring-white/10" : "hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={clsx("h-4.5 w-4.5", active && "text-emerald-300")} />
                    {label}
                    {pendiente === href && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-emerald-300" aria-hidden />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-series-1 text-sm font-bold text-white">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-200">{user.email}</p>
              <span
                className={clsx(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                  ROLE_STYLE[user.role] ?? "bg-white/10 text-slate-300 ring-white/20",
                )}
              >
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium hover:bg-red-500/10 hover:text-red-300">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </form>
          <p className="mt-3 text-center text-[10px] text-slate-300">Informática y Tributos © {new Date().getFullYear()}</p>
        </div>
      </aside>
    </>
  );
}
