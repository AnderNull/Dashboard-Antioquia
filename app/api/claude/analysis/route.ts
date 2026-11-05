import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { getProjectData } from "@/lib/googleSheets";
import { analysisSchema, type AnalysisResponse } from "@/lib/analysisSchema";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const SYSTEM = `Eres un PMO senior y consultor de proyectos de software tributario para entidades públicas colombianas.
Analizas el proyecto TAXATION SMART que la empresa Informática y Tributos desarrolla para la Gobernación de Antioquia
(impuesto vehicular, registro, estampillas, consumo, fiscalización, cobro coactivo, recaudo, etc.).

Con los datos vigentes del proyecto (tareas, levantamientos de requerimientos y registro de bloqueos), entrega un diagnóstico
objetivo y accionable en español:
- Salud del proyecto: estado, puntaje 0-100, resumen ejecutivo y riesgos principales. Considera avance, tareas vencidas,
  prioridad Alta pendiente, concentración de bloqueos y antigüedad de los bloqueos abiertos.
- Responsabilidad de los bloqueos: separa lo atribuible al equipo técnico (Técnico, Dependencia, y Funcional cuando es interno)
  de lo que depende de respuestas o decisiones de la Gobernación (Cliente/Gobernación, y Funcional cuando espera definición del cliente).
  Los porcentajes deben sumar 100 (o ambos 0 si no hay bloqueos).
- Métricas de levantamientos: totales, aprobados, pendientes, tasa de aprobación y lectura del flujo de requerimientos.
- Exactamente 3 acciones de mitigación concretas, con responsable (rol), prioridad y plazo sugerido.
Basa cada afirmación en los datos; si faltan datos, dilo en lugar de suponer. Cita IDs de tareas cuando aplique.`;

function daysSince(date: string) {
  const d = Date.parse(date);
  return Number.isNaN(d) ? null : Math.floor((Date.now() - d) / 86_400_000);
}

export async function POST() {
  const s = await requirePermiso(PERMISOS.analisisIA);
  if (s instanceof NextResponse) return s;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." }, { status: 503 });
  }

  try {
    const { tareas, levantamientos, bloqueos } = await getProjectData();
    const hoy = new Date().toISOString().slice(0, 10);

    const stats = {
      total_tareas: tareas.length,
      completadas: tareas.filter((t) => t.Estado === "Completado").length,
      en_progreso: tareas.filter((t) => t.Estado === "En Progreso").length,
      en_revision: tareas.filter((t) => t.Estado === "En Revisión").length,
      por_hacer: tareas.filter((t) => t.Estado === "Por Hacer").length,
      bloqueadas: tareas.filter((t) => t.Bloqueado === "Sí").length,
      vencidas: tareas.filter((t) => t.Estado !== "Completado" && t.Fecha_Entrega && t.Fecha_Entrega < hoy).length,
      bloqueos_abiertos: bloqueos.filter((b) => b.Estado !== "Resuelto").length,
      levantamientos: levantamientos.length,
      completadas_con_fechas: tareas.filter((t) => t.Estado === "Completado" && t.Fecha_Entrega && t.Fecha_Finalizacion).length,
      entregadas_a_tiempo: tareas.filter((t) => t.Estado === "Completado" && t.Fecha_Entrega && t.Fecha_Finalizacion && t.Fecha_Finalizacion <= t.Fecha_Entrega).length,
    };

    const datos = {
      fecha_corte: hoy,
      resumen: stats,
      tareas: tareas.map((t) => ({
        id: t.ID,
        tarea: t["Requerimiento/Tarea"],
        modulo: t.Modulo_Taxation,
        estado: t.Estado,
        prioridad: t.Prioridad,
        responsable: t.Responsable,
        entrega: t.Fecha_Entrega,
        finalizada: t.Fecha_Finalizacion || undefined,
        bloqueada: t.Bloqueado === "Sí",
        detalle_bloqueo: t.Detalle_Bloqueo || undefined,
        etiquetas: t.Etiquetas || undefined,
        // Contexto breve: más detalle en las abiertas, que son las que requieren decisiones
        notas: t.Descripcion ? t.Descripcion.slice(0, t.Estado === "Completado" ? 160 : 500) : undefined,
      })),
      bloqueos: bloqueos.map((b) => ({
        id: b.ID,
        tarea_id: b.Tarea_ID,
        tipo: b.Tipo_Bloqueo,
        descripcion: b.Descripcion_Bloqueo,
        estado: b.Estado,
        registro: b.Fecha_Registro,
        dias_abierto: b.Estado !== "Resuelto" ? daysSince(b.Fecha_Registro) : undefined,
        resolucion: b.Fecha_Resolucion || undefined,
      })),
      levantamientos: levantamientos.map((l) => ({
        codigo: l.Codigo_Requerimiento,
        descripcion: l.Descripcion_Gobernacion,
        modulo: l.Modulo_Afectado,
        impacto: l.Impacto_Tributario,
        estado: l.Estado_Aprobacion,
        fecha: l.Fecha_Levantamiento,
      })),
    };

    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // si el modelo declina por política, la API reintenta en un modelo de respaldo
      output_config: { effort: "medium", format: betaZodOutputFormat(analysisSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Datos vigentes del proyecto TAXATION SMART (exportados de Google Sheets):\n\n<datos>\n${JSON.stringify(datos)}\n</datos>\n\nGenera el diagnóstico estructurado.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "El modelo no pudo completar el análisis para estos datos." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return NextResponse.json({ error: "La respuesta del modelo llegó incompleta. Intenta de nuevo." }, { status: 502 });
    }

    const body: AnalysisResponse = {
      analysis: response.parsed_output,
      model: response.model,
      generatedAt: new Date().toISOString(),
      stats,
    };
    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Límite de uso de la API de Claude alcanzado. Intenta en unos minutos." }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY inválida." }, { status: 503 });
    }
    if (e instanceof Anthropic.APIError) {
      console.error("Claude API error", e.status, e.message);
      return NextResponse.json({ error: `Error de la API de Claude (${e.status ?? "sin estado"}).` }, { status: 502 });
    }
    return handleError(e);
  }
}
