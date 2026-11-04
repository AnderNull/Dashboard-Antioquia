import { NextResponse } from "next/server";
import { PERMISOS, can, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, appendRow, getLevantamientos, newId, today } from "@/lib/googleSheets";
import { levantamientoSchema, zodMessage } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requirePermiso();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await getLevantamientos());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const s = await requirePermiso(PERMISOS.crearLevantamientos);
  if (s instanceof NextResponse) return s;
  try {
    const parsed = levantamientoSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const lev = {
      ...parsed.data,
      ID: newId("L"),
      Fecha_Levantamiento: parsed.data.Fecha_Levantamiento || today(),
      // Solo Admin/Gobernación pueden fijar un estado distinto a Pendiente al crear
      Estado_Aprobacion: can(s, PERMISOS.editarLevantamientos)
        ? parsed.data.Estado_Aprobacion
        : "Pendiente",
    };
    await appendRow(SHEETS.levantamientos, lev);
    return NextResponse.json(lev, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
