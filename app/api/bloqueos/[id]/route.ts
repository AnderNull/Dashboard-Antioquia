import { NextResponse } from "next/server";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, getBloqueos, today, updateRow } from "@/lib/googleSheets";
import { bloqueoPatchSchema, zodMessage } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Cambia el estado de un bloqueo. Al resolver el último bloqueo abierto, desbloquea la tarea. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.gestionarBloqueos);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const parsed = bloqueoPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });

    const { Estado } = parsed.data;
    const updated = await updateRow(SHEETS.bloqueos, id, {
      Estado,
      Fecha_Resolucion: Estado === "Resuelto" ? today() : "",
    });
    if (!updated) return NextResponse.json({ error: "Bloqueo no encontrado" }, { status: 404 });

    let tareaDesbloqueada = false;
    if (Estado === "Resuelto") {
      const otrosAbiertos = (await getBloqueos()).some(
        (b) => b.Tarea_ID === updated.Tarea_ID && b.ID !== id && b.Estado !== "Resuelto",
      );
      if (!otrosAbiertos) {
        tareaDesbloqueada = !!(await updateRow(SHEETS.tareas, updated.Tarea_ID, { Bloqueado: "No", Detalle_Bloqueo: "" }));
      }
    }
    return NextResponse.json({ bloqueo: updated, tareaDesbloqueada });
  } catch (e) {
    return handleError(e);
  }
}
