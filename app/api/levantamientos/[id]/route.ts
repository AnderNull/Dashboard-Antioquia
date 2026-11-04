import { NextResponse } from "next/server";
import { PERMISOS, handleError, requireRole } from "@/lib/api";
import { SHEETS, deleteRow, updateRow } from "@/lib/googleSheets";
import { levantamientoPatchSchema, zodMessage } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireRole(PERMISOS.editarLevantamientos);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const parsed = levantamientoPatchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const updated = await updateRow(SHEETS.levantamientos, id, parsed.data as Record<string, string>);
    if (!updated) return NextResponse.json({ error: "Levantamiento no encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireRole(PERMISOS.eliminarLevantamientos);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const ok = await deleteRow(SHEETS.levantamientos, id);
    if (!ok) return NextResponse.json({ error: "Levantamiento no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
