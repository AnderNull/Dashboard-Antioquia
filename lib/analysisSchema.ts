import { z } from "zod";

/** Estructura del diagnóstico que devuelve Claude (salida estructurada). */
export const analysisSchema = z.object({
  salud_proyecto: z.object({
    estado: z.enum(["Saludable", "En Riesgo", "Crítico"]),
    puntaje: z.number().describe("Puntaje de salud de 0 a 100"),
    resumen: z.string().describe("Diagnóstico ejecutivo en 2-4 frases"),
    riesgos_principales: z.array(z.string()),
  }),
  responsabilidad_bloqueos: z.object({
    tecnico_equipo_pct: z.number().describe("% de bloqueos atribuibles al equipo (Técnico + Dependencia + Funcional interno)"),
    gobernacion_pct: z.number().describe("% de bloqueos atribuibles a respuesta/decisión de la Gobernación"),
    analisis: z.string(),
    bloqueos_criticos: z.array(
      z.object({
        tarea_id: z.string(),
        responsable: z.enum(["Equipo técnico", "Gobernación", "Compartido"]),
        motivo: z.string(),
      }),
    ),
  }),
  metricas_levantamientos: z.object({
    total: z.number(),
    aprobados: z.number(),
    pendientes: z.number(),
    tasa_aprobacion_pct: z.number(),
    analisis: z.string(),
  }),
  acciones_mitigacion: z
    .array(
      z.object({
        titulo: z.string(),
        descripcion: z.string(),
        responsable: z.string(),
        prioridad: z.enum(["Alta", "Media", "Baja"]),
        plazo: z.string(),
      }),
    )
    .describe("Exactamente 3 acciones"),
});

export type Analysis = z.infer<typeof analysisSchema>;

export type AnalysisResponse = {
  analysis: Analysis;
  model: string;
  generatedAt: string;
  stats: Record<string, number>;
};
