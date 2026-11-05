import { z } from "zod";
import { ESTADOS_TAREA, PRIORIDADES, TIPOS_BLOQUEO, ESTADOS_BLOQUEO } from "./types";

const txt = (max = 500) => z.string().trim().max(max);
const fecha = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Formato de fecha AAAA-MM-DD");

// Formas base SIN valores por defecto: las de "patch" las reutilizan con .partial()
// (en Zod 4, .partial() conserva los .default() y sobrescribiría campos no enviados).
const tareaShape = {
  Proyecto: txt(120),
  "Requerimiento/Tarea": txt(500).min(3, "Describe la tarea"),
  Modulo_Taxation: txt(120).min(1, "Selecciona el módulo"),
  Estado: z.enum(ESTADOS_TAREA),
  Prioridad: z.enum(PRIORIDADES),
  Responsable: txt(120),
  Fecha_Inicio: fecha,
  Fecha_Entrega: fecha,
  Bloqueado: z.enum(["Sí", "No"]),
  Detalle_Bloqueo: txt(1000),
  Descripcion: txt(5000),
  Fecha_Finalizacion: fecha,
  Etiquetas: txt(300),
  // Solo para registrar el bloqueo en Bloqueos_Log (no es columna de la tarea)
  Tipo_Bloqueo: z.enum(TIPOS_BLOQUEO).optional(),
};

export const tareaPatchSchema = z.object(tareaShape).partial();

export const tareaSchema = z.object({
  ...tareaShape,
  Proyecto: tareaShape.Proyecto.default("TAXATION SMART"),
  Estado: tareaShape.Estado.default("Por Hacer"),
  Prioridad: tareaShape.Prioridad.default("Media"),
  Responsable: tareaShape.Responsable.default(""),
  Fecha_Inicio: fecha.default(""),
  Fecha_Entrega: fecha.default(""),
  Bloqueado: tareaShape.Bloqueado.default("No"),
  Detalle_Bloqueo: tareaShape.Detalle_Bloqueo.default(""),
  Descripcion: tareaShape.Descripcion.default(""),
  Fecha_Finalizacion: fecha.default(""),
  Etiquetas: tareaShape.Etiquetas.default(""),
});

const levShape = {
  Codigo_Requerimiento: txt(60).min(1, "Código requerido"),
  Descripcion_Gobernacion: txt(2000).min(3, "Describe el requerimiento"),
  Modulo_Afectado: txt(120).min(1, "Selecciona el módulo"),
  Impacto_Tributario: txt(500),
  Estado_Aprobacion: txt(40),
  Fecha_Levantamiento: fecha,
};

export const levantamientoPatchSchema = z.object(levShape).partial();

export const levantamientoSchema = z.object({
  ...levShape,
  Impacto_Tributario: levShape.Impacto_Tributario.default(""),
  Estado_Aprobacion: levShape.Estado_Aprobacion.default("Pendiente"),
  Fecha_Levantamiento: fecha.default(""),
});

export const bloqueoPatchSchema = z.object({ Estado: z.enum(ESTADOS_BLOQUEO) });

export function zodMessage(err: z.ZodError) {
  return err.issues.map((i) => `${i.path.join(".") || "campo"}: ${i.message}`).join("; ");
}
