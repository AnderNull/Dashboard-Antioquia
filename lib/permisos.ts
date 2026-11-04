// Catálogo de permisos. Sin dependencias de servidor: lo usan el middleware, la API y la UI.
import type { Rol } from "./types";

export const CATALOGO_PERMISOS = [
  { key: "tareas.editar", grupo: "Tareas y bloqueos", label: "Crear y editar tareas", desc: "Crear tareas, moverlas en el Kanban y cambiar sus fechas." },
  { key: "tareas.eliminar", grupo: "Tareas y bloqueos", label: "Eliminar tareas", desc: "Borrar tareas de la hoja Proyectos_Tareas." },
  { key: "bloqueos.gestionar", grupo: "Tareas y bloqueos", label: "Gestionar bloqueos", desc: "Cambiar el estado de los bloqueos (Abierto, En Gestión, Resuelto)." },
  { key: "levantamientos.crear", grupo: "Levantamientos", label: "Registrar levantamientos", desc: "Crear nuevos requerimientos (quedan como Pendiente)." },
  { key: "levantamientos.editar", grupo: "Levantamientos", label: "Editar y aprobar levantamientos", desc: "Modificar levantamientos y cambiar su estado de aprobación." },
  { key: "levantamientos.eliminar", grupo: "Levantamientos", label: "Eliminar levantamientos", desc: "Borrar levantamientos de la hoja." },
  { key: "analisis.ia", grupo: "Analítica", label: "Generar análisis con IA", desc: "Ejecutar el diagnóstico del proyecto con Claude (consume créditos de la API)." },
  { key: "usuarios.administrar", grupo: "Administración", label: "Administrar usuarios y permisos", desc: "Crear, editar, desactivar y eliminar usuarios y definir sus permisos." },
  { key: "configuracion.administrar", grupo: "Administración", label: "Administrar configuración", desc: "Gestionar los catálogos: módulos Taxation, responsables e impacto tributario." },
] as const;

export type Permiso = (typeof CATALOGO_PERMISOS)[number]["key"];

export const TODOS_LOS_PERMISOS: Permiso[] = CATALOGO_PERMISOS.map((p) => p.key);

/** Permisos por defecto de cada rol (se usan cuando el usuario no tiene permisos personalizados). */
export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  Admin: TODOS_LOS_PERMISOS,
  Desarrollador: ["tareas.editar", "bloqueos.gestionar", "levantamientos.crear", "analisis.ia"],
  Gobernacion: ["levantamientos.crear", "levantamientos.editar", "analisis.ia"],
};

/** Valor guardado en la hoja cuando se personaliza sin ningún permiso. */
export const SIN_PERMISOS = "ninguno";

const esPermiso = (k: string): k is Permiso => (TODOS_LOS_PERMISOS as string[]).includes(k);

/**
 * Permisos efectivos de un usuario.
 * - Admin siempre tiene todos (evita quedarse sin administradores).
 * - Columna "Permisos" vacía → permisos por defecto del rol.
 * - "ninguno" → personalizado sin permisos. Lista separada por comas → personalizado.
 */
export function resolverPermisos(rol: string, columna?: string | null): Permiso[] {
  if (rol === "Admin") return TODOS_LOS_PERMISOS;
  const v = (columna ?? "").trim();
  if (!v) return PERMISOS_POR_ROL[rol as Rol] ?? [];
  if (v === SIN_PERMISOS) return [];
  return [...new Set(v.split(/[,;\s]+/).filter(esPermiso))];
}

/** Convierte la elección de la UI al valor que se guarda en la hoja. null = usar los del rol. */
export function serializarPermisos(permisos: string[] | null): string {
  if (permisos === null) return "";
  const validos = [...new Set(permisos.filter(esPermiso))];
  return validos.length ? validos.join(",") : SIN_PERMISOS;
}
