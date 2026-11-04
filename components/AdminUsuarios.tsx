"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Eye, EyeOff, KeyRound, Loader2, Minus, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users, Wand2 } from "lucide-react";
import { Modal } from "./ui";
import { ROLES, type Rol, type UsuarioPublico } from "@/lib/types";
import { CATALOGO_PERMISOS, PERMISOS_POR_ROL, resolverPermisos, SIN_PERMISOS, type Permiso } from "@/lib/permisos";

const ROLE_LABEL: Record<string, string> = { Gobernacion: "Gobernación" };
const ROLE_STYLE: Record<string, string> = {
  Admin: "bg-amber-50/80 text-amber-800 ring-amber-200",
  Desarrollador: "bg-sky-50/80 text-sky-700 ring-sky-200",
  Gobernacion: "bg-emerald-50/80 text-emerald-700 ring-emerald-200",
};
const GRUPOS = [...new Set(CATALOGO_PERMISOS.map((p) => p.grupo))];

type Draft = {
  ID?: string;
  Nombre: string;
  Email: string;
  Rol: Rol;
  Estado: "Activo" | "Inactivo";
  Password: string;
  modo: "rol" | "custom";
  permisos: Permiso[];
};

const nuevoDraft = (): Draft => ({
  Nombre: "",
  Email: "",
  Rol: "Desarrollador",
  Estado: "Activo",
  Password: "",
  modo: "rol",
  permisos: [...PERMISOS_POR_ROL.Desarrollador],
});

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
  return body as T;
}

function generarPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#$%*?";
  const buf = new Uint32Array(14);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

const iniciales = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

const personalizado = (u: UsuarioPublico) => u.Rol !== "Admin" && !!(u.Permisos ?? "").trim();

export default function AdminUsuarios({ initialUsuarios, currentUserId }: { initialUsuarios: UsuarioPublico[]; currentUserId: string }) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [verPass, setVerPass] = useState(false);

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    return usuarios
      .filter((u) => !s || [u.Nombre, u.Email, u.Rol, u.ID].some((v) => v?.toLowerCase().includes(s)))
      .sort((a, b) => a.Nombre.localeCompare(b.Nombre, "es"));
  }, [usuarios, q]);

  const stats = {
    total: usuarios.length,
    activos: usuarios.filter((u) => u.Estado === "Activo").length,
    inactivos: usuarios.filter((u) => u.Estado !== "Activo").length,
    admins: usuarios.filter((u) => u.Estado === "Activo" && resolverPermisos(u.Rol, u.Permisos).includes("usuarios.administrar")).length,
  };

  function abrirNuevo() {
    setError(null);
    setVerPass(false);
    setDraft(nuevoDraft());
  }

  function abrirEditar(u: UsuarioPublico) {
    setError(null);
    setVerPass(false);
    setDraft({
      ID: u.ID,
      Nombre: u.Nombre,
      Email: u.Email,
      Rol: (ROLES as readonly string[]).includes(u.Rol) ? u.Rol : "Desarrollador",
      Estado: u.Estado === "Activo" ? "Activo" : "Inactivo",
      Password: "",
      modo: personalizado(u) ? "custom" : "rol",
      permisos: resolverPermisos(u.Rol, u.Permisos),
    });
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function cambiarRol(rol: Rol) {
    setDraft((d) => (d ? { ...d, Rol: rol, permisos: d.modo === "rol" ? [...PERMISOS_POR_ROL[rol]] : d.permisos } : d));
  }

  function cambiarModo(modo: Draft["modo"]) {
    setDraft((d) => (d ? { ...d, modo, permisos: modo === "rol" ? [...PERMISOS_POR_ROL[d.Rol]] : d.permisos } : d));
  }

  function togglePermiso(p: Permiso) {
    setDraft((d) => (d ? { ...d, permisos: d.permisos.includes(p) ? d.permisos.filter((x) => x !== p) : [...d.permisos, p] } : d));
  }

  async function guardar() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        Nombre: draft.Nombre,
        Email: draft.Email,
        Rol: draft.Rol,
        Estado: draft.Estado,
        Password: draft.Password,
        Permisos: draft.Rol === "Admin" || draft.modo === "rol" ? null : draft.permisos,
      };
      if (draft.ID) {
        const u = await api<UsuarioPublico>(`/api/admin/usuarios/${draft.ID}`, { method: "PATCH", body: JSON.stringify(body) });
        setUsuarios((us) => us.map((x) => (x.ID === u.ID ? u : x)));
        notify(`Usuario ${u.Nombre} actualizado`);
      } else {
        const u = await api<UsuarioPublico>("/api/admin/usuarios", { method: "POST", body: JSON.stringify(body) });
        setUsuarios((us) => [...us, u]);
        notify(`Usuario ${u.Nombre} creado (${u.ID})`);
      }
      setDraft(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(u: UsuarioPublico) {
    const Estado = u.Estado === "Activo" ? "Inactivo" : "Activo";
    try {
      const r = await api<UsuarioPublico>(`/api/admin/usuarios/${u.ID}`, { method: "PATCH", body: JSON.stringify({ Estado }) });
      setUsuarios((us) => us.map((x) => (x.ID === r.ID ? r : x)));
      notify(`${r.Nombre}: ${Estado === "Activo" ? "acceso activado" : "acceso desactivado"}`);
    } catch (e) {
      notify((e as Error).message);
    }
  }

  async function eliminar(u: UsuarioPublico) {
    if (!confirm(`¿Eliminar definitivamente a ${u.Nombre} (${u.Email})?\n\nSi solo quieres quitarle el acceso, usa "Desactivar".`)) return;
    try {
      await api(`/api/admin/usuarios/${u.ID}`, { method: "DELETE" });
      setUsuarios((us) => us.filter((x) => x.ID !== u.ID));
      setDraft(null);
      notify(`Usuario ${u.Nombre} eliminado`);
    } catch (e) {
      notify((e as Error).message);
    }
  }

  const esYo = draft?.ID === currentUserId;
  const efectivos = draft ? (draft.Rol === "Admin" ? CATALOGO_PERMISOS.map((p) => p.key) : draft.permisos) : [];
  const valido =
    !!draft &&
    draft.Nombre.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(draft.Email) &&
    (draft.ID ? draft.Password === "" || draft.Password.length >= 8 : draft.Password.length >= 8);

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Usuarios", value: stats.total, icon: Users, tone: "text-series-1 bg-series-1/10" },
          { label: "Activos", value: stats.activos, icon: Check, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Inactivos", value: stats.inactivos, icon: Minus, tone: "text-slate-600 bg-slate-100" },
          { label: "Pueden administrar", value: stats.admins, icon: ShieldCheck, tone: "text-amber-700 bg-amber-50" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={clsx("rounded-lg p-2", tone)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Usuarios */}
      <section className="card overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-white/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-ink-900">Usuarios autorizados</h3>
            <p className="text-xs text-slate-500">Pestaña Usuarios_Autorizados · los cambios aplican en menos de 30 segundos, sin cerrar sesión</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario…" className="input pl-9 sm:w-60" />
            </div>
            <button onClick={abrirNuevo} className="btn-primary">
              <UserPlus className="h-4 w-4" /> Nuevo usuario
            </button>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/20 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Usuario</th>
                <th className="px-3 py-2.5">Rol</th>
                <th className="px-3 py-2.5">Permisos</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/60">
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">No hay usuarios que coincidan.</td>
                </tr>
              )}
              {visibles.map((u) => {
                const perms = resolverPermisos(u.Rol, u.Permisos);
                const yo = u.ID === currentUserId;
                return (
                  <tr key={u.ID} className={clsx("transition-colors hover:bg-white/30", u.Estado !== "Activo" && "opacity-60")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-series-1 text-xs font-bold text-white">
                          {iniciales(u.Nombre)}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium text-ink-900">
                            {u.Nombre}
                            {yo && <span className="rounded-full bg-ink-900 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Tú</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {u.Email} · <span className="font-mono">{u.ID}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold ring-1", ROLE_STYLE[u.Rol] ?? "bg-slate-50 text-slate-600 ring-slate-200")}>
                        {ROLE_LABEL[u.Rol] ?? u.Rol}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {u.Rol === "Admin" ? (
                        <span className="font-medium text-amber-800">Todos ({perms.length})</span>
                      ) : personalizado(u) ? (
                        <span title={perms.join("\n") || "Sin permisos"}>
                          <span className="font-medium text-violet-700">Personalizados</span> · {perms.length} de {CATALOGO_PERMISOS.length}
                        </span>
                      ) : (
                        <span>Según el rol · {perms.length} de {CATALOGO_PERMISOS.length}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => cambiarEstado(u)}
                        disabled={yo}
                        title={yo ? "No puedes desactivarte a ti mismo" : u.Estado === "Activo" ? "Desactivar acceso" : "Activar acceso"}
                        className="flex items-center gap-2 text-xs font-medium text-slate-600 disabled:cursor-not-allowed"
                        role="switch"
                        aria-checked={u.Estado === "Activo"}
                      >
                        <span className={clsx("relative h-5 w-9 rounded-full transition-colors", u.Estado === "Activo" ? "bg-emerald-500" : "bg-slate-300")}>
                          <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", u.Estado === "Activo" ? "left-[18px]" : "left-0.5")} />
                        </span>
                        {u.Estado === "Activo" ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => abrirEditar(u)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-800" aria-label={`Editar ${u.Nombre}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!yo && (
                          <button onClick={() => eliminar(u)} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${u.Nombre}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Matriz de referencia */}
      <section className="card overflow-hidden">
        <header className="border-b border-white/60 p-5">
          <h3 className="font-semibold text-ink-900">Permisos por defecto de cada rol</h3>
          <p className="text-xs text-slate-500">Se aplican a los usuarios sin permisos personalizados. El rol Admin siempre tiene todos.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/20 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2.5">Permiso</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center">{ROLE_LABEL[r] ?? r}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/60">
              {CATALOGO_PERMISOS.map((p) => (
                <tr key={p.key}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-ink-900">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {PERMISOS_POR_ROL[r].includes(p.key) ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Sí" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="No" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal crear / editar */}
      {draft && (
        <Modal title={draft.ID ? `Editar usuario ${draft.ID}` : "Nuevo usuario"} onClose={() => setDraft(null)} wide>
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nombre completo *</label>
              <input className="input" value={draft.Nombre} onChange={(e) => set("Nombre", e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Correo electrónico *</label>
              <input type="email" className="input" value={draft.Email} onChange={(e) => set("Email", e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={draft.Rol} onChange={(e) => cambiarRol(e.target.value as Rol)} disabled={esYo}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                ))}
              </select>
              {esYo && <p className="mt-1 text-[11px] text-slate-500">No puedes cambiar tu propio rol.</p>}
            </div>
            <div>
              <label className="label">Estado</label>
              <select className="input" value={draft.Estado} onChange={(e) => set("Estado", e.target.value as Draft["Estado"])} disabled={esYo}>
                <option value="Activo">Activo (puede iniciar sesión)</option>
                <option value="Inactivo">Inactivo (sin acceso)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">{draft.ID ? "Nueva contraseña (opcional)" : "Contraseña inicial *"}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={verPass ? "text" : "password"}
                    className="input pl-9 pr-9"
                    value={draft.Password}
                    onChange={(e) => set("Password", e.target.value)}
                    placeholder={draft.ID ? "Dejar vacío para mantener la actual" : "Mínimo 8 caracteres"}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass((v) => !v)}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
                    aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    set("Password", generarPassword());
                    setVerPass(true);
                  }}
                  className="btn-ghost"
                >
                  <Wand2 className="h-4 w-4" /> Generar
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Se guarda cifrada (bcrypt). Compártela con el usuario por un canal seguro; después no se puede volver a ver.
              </p>
            </div>

            {/* Permisos */}
            <div className="sm:col-span-2 rounded-2xl border border-white/70 bg-white/30 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <ShieldCheck className="h-4 w-4 text-brand-600" /> Permisos
              </p>
              {draft.Rol === "Admin" ? (
                <p className="rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                  El rol <b>Admin</b> tiene siempre todos los permisos, incluida la administración de usuarios.
                </p>
              ) : (
                <div className="mb-3 inline-flex rounded-xl border border-white/60 bg-white/40 p-1" role="radiogroup" aria-label="Origen de los permisos">
                  {([
                    ["rol", `Usar los del rol ${ROLE_LABEL[draft.Rol] ?? draft.Rol}`],
                    ["custom", "Personalizar"],
                  ] as const).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={draft.modo === m}
                      onClick={() => cambiarModo(m)}
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        draft.modo === m ? "bg-white/90 text-ink-900 shadow-sm" : "text-slate-600 hover:bg-white/50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-4">
                {GRUPOS.map((g) => (
                  <div key={g}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CATALOGO_PERMISOS.filter((p) => p.grupo === g).map((p) => {
                        const activo = efectivos.includes(p.key);
                        const editable = draft.Rol !== "Admin" && draft.modo === "custom" && !(esYo && p.key === "usuarios.administrar");
                        return (
                          <label
                            key={p.key}
                            className={clsx(
                              "flex gap-2.5 rounded-xl p-2.5 ring-1 transition",
                              activo ? "bg-white/70 ring-brand-500/40" : "bg-white/25 ring-white/60",
                              editable ? "cursor-pointer hover:bg-white/60" : "cursor-default opacity-80",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-brand-600"
                              checked={activo}
                              disabled={!editable}
                              onChange={() => togglePermiso(p.key)}
                            />
                            <span>
                              <span className="block text-sm font-medium text-ink-900">{p.label}</span>
                              <span className="block text-[11px] leading-snug text-slate-500">{p.desc}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {draft.Rol !== "Admin" && draft.modo === "custom" && draft.permisos.length === 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  Sin permisos: el usuario solo podrá consultar la información (se guarda como «{SIN_PERMISOS}»).
                </p>
              )}
            </div>
          </fieldset>

          {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex items-center justify-between gap-2">
            <div>
              {draft.ID && !esYo && (
                <button
                  onClick={() => {
                    const u = usuarios.find((x) => x.ID === draft.ID);
                    if (u) eliminar(u);
                  }}
                  disabled={saving}
                  className="btn-danger"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDraft(null)} className="btn-ghost">Cancelar</button>
              <button onClick={guardar} disabled={saving || !valido} className="btn-primary">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} {draft.ID ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-2xl border glass-dark animate-modal-in px-4 py-3 text-sm text-white">{toast}</div>}
    </div>
  );
}
