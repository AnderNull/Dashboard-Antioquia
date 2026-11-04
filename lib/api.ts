import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { SheetsConfigError } from "./googleSheets";
import type { Permiso } from "./permisos";

/** Nombres cortos de los permisos que usa cada acción de la API y de la UI. */
export const PERMISOS = {
  editarTareas: "tareas.editar",
  eliminarTareas: "tareas.eliminar",
  gestionarBloqueos: "bloqueos.gestionar",
  crearLevantamientos: "levantamientos.crear",
  editarLevantamientos: "levantamientos.editar",
  eliminarLevantamientos: "levantamientos.eliminar",
  analisisIA: "analisis.ia",
  administrarUsuarios: "usuarios.administrar",
  administrarConfiguracion: "configuracion.administrar",
} as const satisfies Record<string, Permiso>;

export function can(session: Session | null, permiso: Permiso) {
  return !!session?.user && (session.user.permisos ?? []).includes(permiso);
}

/**
 * Valida la sesión y, si se indica, un permiso. Devuelve la sesión o una respuesta de error.
 * Sin permiso basta con estar autenticado (lectura).
 */
export async function requirePermiso(permiso?: Permiso): Promise<Session | NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (permiso && !can(session, permiso)) return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  return session;
}

export function handleError(err: unknown) {
  if (err instanceof SheetsConfigError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error(err);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}
