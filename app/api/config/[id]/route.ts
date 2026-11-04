import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, deleteRow, getItemsCatalogo, updateRow } from "@/lib/googleSheets";
import { zodMessage } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    Valor: z.string().trim().min(1, "El nombre es obligatorio").max(120),
    Descripcion: z.string().trim().max(200),
    Orden: z.coerce.number().int().min(0).max(100000).transform(String),
    Estado: z.enum(["Activo", "Inactivo"]),
  })
  .partial();

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.administrarConfiguracion);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });

    if (parsed.data.Valor) {
      const items = await getItemsCatalogo();
      const actual = items.find((i) => i.ID === id);
      const dup = actual && items.some((i) => i.ID !== id && i.Tipo === actual.Tipo && i.Valor.trim().toLowerCase() === parsed.data.Valor!.toLowerCase());
      if (dup) return NextResponse.json({ error: `"${parsed.data.Valor}" ya existe en la lista.` }, { status: 409 });
    }

    const updated = await updateRow(SHEETS.config, id, parsed.data as Record<string, string>);
    if (!updated) return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.administrarConfiguracion);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const ok = await deleteRow(SHEETS.config, id);
    if (!ok) return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
