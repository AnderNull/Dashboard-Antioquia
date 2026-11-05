import { NextResponse } from "next/server";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, appendRow, getTareas, newId, today } from "@/lib/googleSheets";
import { syncBloqueo } from "@/lib/bloqueos";
import { tareaSchema, zodMessage } from "@/lib/schemas";
import { leerChecklist, progresoChecklist, serializarChecklist } from "@/lib/checklist";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requirePermiso();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await getTareas());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const s = await requirePermiso(PERMISOS.editarTareas);
  if (s instanceof NextResponse) return s;
  try {
    const parsed = tareaSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { Tipo_Bloqueo, ...data } = parsed.data;
    const tarea = { ...data, ID: newId("T"), Fecha_Creacion: today() };
    if (tarea.Bloqueado === "No") tarea.Detalle_Bloqueo = "";
    if (tarea.Estado === "Completado" && !tarea.Fecha_Finalizacion) tarea.Fecha_Finalizacion = today();
    if (tarea.Estado !== "Completado") tarea.Fecha_Finalizacion = "";
    // Lista de tareas normalizada y su avance (hechos/total)
    const items = leerChecklist(tarea.Checklist);
    const nueva = { ...tarea, Checklist: serializarChecklist(items), Checklist_Progreso: progresoChecklist(items) };

    await appendRow(SHEETS.tareas, nueva);
    if (nueva.Bloqueado === "Sí") {
      await syncBloqueo({ tareaId: nueva.ID, bloqueado: true, descripcion: nueva.Detalle_Bloqueo, tipo: Tipo_Bloqueo });
    }
    return NextResponse.json(nueva, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
