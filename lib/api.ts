import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { SheetsConfigError } from "./googleSheets";
import type { Rol } from "./types";

/** Permisos por rol. */
export const PERMISOS = {
  editarTareas: ["Admin", "Desarrollador"] as Rol[],
  eliminarTareas: ["Admin"] as Rol[],
  crearLevantamientos: ["Admin", "Desarrollador", "Gobernacion"] as Rol[],
  editarLevantamientos: ["Admin", "Gobernacion"] as Rol[],
  eliminarLevantamientos: ["Admin"] as Rol[],
  analisisIA: ["Admin", "Desarrollador", "Gobernacion"] as Rol[],
};

export function can(session: Session | null, roles: Rol[]) {
  return !!session?.user && roles.includes(session.user.role as Rol);
}

/** Valida sesión y rol; devuelve la sesión o una respuesta de error. */
export async function requireRole(roles: Rol[]): Promise<Session | NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!can(session, roles)) return NextResponse.json({ error: "Permisos insuficientes" }, { status: 403 });
  return session;
}

export function handleError(err: unknown) {
  if (err instanceof SheetsConfigError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error(err);
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}
