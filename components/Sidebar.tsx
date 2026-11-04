"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Activity, BrainCircuit, ClipboardList, KanbanSquare, LayoutDashboard, Loader2, LogOut, Menu, UserCog, X } from "lucide-react";
import { TaxationLogo } from "./Brand";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/metricas", label: "Métricas en vivo", icon: Activity },
  { href: "/dashboard/tasks", label: "Kanban y Bloqueos", icon: KanbanSquare },
  { href: "/dashboard/levantamientos", label: "Levantamientos", icon: ClipboardList },
  { href: "/dashboard/analytics", label: "Analítica IA", icon: BrainCircuit },
];
const NAV_ADMIN = [{ href: "/dashboard/admin", label: "Usuarios y permisos", icon: UserCog }];

const ROLE_STYLE: Record<string, string> = {
  Admin: "bg-amber-50/90 text-amber-800 ring-amber-300/70",
  Desarrollador: "bg-brand-50/90 text-brand-600 ring-brand-300/70",
  Gobernacion: "bg-gov-50/90 text-gov-600 ring-emerald-300/70",
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
          <div className="h-full w-1/3 animate-[nav-progress_1s_ease-in-out_infinite] rounded-full brand-stripe" />
        </div>
      )}
      {/* Barra superior móvil */}
      <header className="fixed inset-x-2 top-2 z-30 flex h-14 items-center justify-between overflow-hidden rounded-2xl glass-nav px-4 text-ink-800 lg:hidden">
        <span className="brand-stripe absolute inset-x-0 top-0 h-[3px]" aria-hidden />
        <div className="w-36"><TaxationLogo /></div>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 hover:bg-white/60">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && <div className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm animate-fade-in lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={clsx(
          "fixed inset-y-2 left-2 z-50 flex w-72 flex-col overflow-hidden rounded-3xl glass-nav text-ink-800 transition-transform duration-300 lg:sticky lg:top-3 lg:m-3 lg:h-[calc(100vh-1.5rem)] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]",
        )}
      >
        <span className="brand-stripe absolute inset-x-0 top-0 h-1" aria-hidden />
        <div className="border-b border-white/70 px-5 pb-4 pt-6">
          <div className="flex items-start gap-2">
            <Link href="/dashboard" className="block flex-1 transition-opacity hover:opacity-90" aria-label="Ir al Overview">
              <TaxationLogo priority className="drop-shadow-[0_2px_6px_rgb(30_40_120/0.12)]" />
            </Link>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/60 lg:hidden" aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.22em] text-brand-600/80">Project Management</p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {[
            { titulo: "Gestión del proyecto", items: NAV },
            ...(user.permisos.includes("usuarios.administrar") ? [{ titulo: "Administración", items: NAV_ADMIN }] : []),
          ].map(({ titulo, items }) => (
            <div key={titulo} className="space-y-1 pb-4">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
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
                      active
                        ? "bg-linear-to-r from-brand-600 to-ink-800 text-white shadow-[0_6px_14px_-6px_rgb(36_83_196/0.7),inset_0_1px_0_0_rgb(255_255_255/0.25)]"
                        : "text-ink-800/85 hover:bg-white/60 hover:text-ink-900",
                    )}
                  >
                    <Icon className={clsx("h-4.5 w-4.5", active ? "text-celeste-400" : "text-brand-600/80")} />
                    {label}
                    {pendiente === href && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-celeste-400" aria-hidden />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/70 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/50 p-3 ring-1 ring-white/80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-ink-800 text-sm font-bold text-white">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              <span
                className={clsx(
                  "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                  ROLE_STYLE[user.role] ?? "bg-white/60 text-slate-600 ring-slate-200",
                )}
              >
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/80 bg-white/30 px-3 py-2 text-sm font-medium text-ink-800 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </form>
          <p className="mt-3 text-center text-[10px] text-slate-500">Informática y Tributos © {new Date().getFullYear()}</p>
        </div>
      </aside>
    </>
  );
}
