// Reglas de negocio de la administración de usuarios (solo servidor).
import { z } from "zod";
import { ROLES, type Usuario, type UsuarioPublico } from "./types";
import { resolverPermisos } from "./permisos";

const base = {
  Nombre: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  Email: z.string().trim().toLowerCase().email("Correo electrónico no válido").max(200),
  Rol: z.enum(ROLES, { message: "Rol no válido" }),
  Estado: z.enum(["Activo", "Inactivo"], { message: "Estado no válido" }),
  /** null = usar los permisos por defecto del rol */
  Permisos: z.array(z.string()).nullable(),
};
const password = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(200, "La contraseña es demasiado larga");

export const crearUsuarioSchema = z.object({ ...base, Password: password });
export const editarUsuarioSchema = z.object({ ...base, Password: password.or(z.literal("")) }).partial();

export function toPublico({ PasswordHash: _omit, ...u }: Usuario): UsuarioPublico {
  void _omit;
  return u;
}

/** Siguiente ID consecutivo U-001, U-002… */
export function siguienteId(usuarios: Usuario[]) {
  const max = usuarios.reduce((m, u) => Math.max(m, Number(/^U-(\d+)$/.exec(u.ID ?? "")?.[1] ?? 0)), 0);
  return `U-${String(max + 1).padStart(3, "0")}`;
}

/** Debe quedar al menos un usuario activo que pueda administrar usuarios. */
export function quedaAdministrador(usuarios: Usuario[]) {
  return usuarios.some((u) => u.Estado === "Activo" && resolverPermisos(u.Rol, u.Permisos).includes("usuarios.administrar"));
}
