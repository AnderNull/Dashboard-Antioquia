import { NextResponse } from "next/server";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, deleteRow, getTareas, today, updateRow } from "@/lib/googleSheets";
import { syncBloqueo } from "@/lib/bloqueos";
import { tareaPatchSchema, zodMessage } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.editarTareas);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const parsed = tareaPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { Tipo_Bloqueo, ...patch } = parsed.data;
    if (patch.Bloqueado === "No") patch.Detalle_Bloqueo = "";

    // Fecha real de finalización: se fija al pasar a Completado y se limpia al reabrir la tarea
    if (patch.Estado && patch.Estado !== "Completado") patch.Fecha_Finalizacion = "";
    if (patch.Estado === "Completado" && !patch.Fecha_Finalizacion) {
      const actual = (await getTareas()).find((t) => t.ID === id);
      patch.Fecha_Finalizacion = actual?.Fecha_Finalizacion || today();
    }

    const updated = await updateRow(SHEETS.tareas, id, patch as Record<string, string>);
    if (!updated) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    if (patch.Bloqueado !== undefined || patch.Detalle_Bloqueo !== undefined || Tipo_Bloqueo) {
      await syncBloqueo({
        tareaId: id,
        bloqueado: updated.Bloqueado === "Sí",
        descripcion: updated.Detalle_Bloqueo,
        tipo: Tipo_Bloqueo,
      });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.eliminarTareas);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const ok = await deleteRow(SHEETS.tareas, id);
    if (!ok) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
