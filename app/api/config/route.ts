import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, appendRow, ensureSheet, getItemsCatalogo, newId } from "@/lib/googleSheets";
import { TIPOS_CATALOGO_KEYS, type ItemCatalogo } from "@/lib/catalogos";
import { zodMessage } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const valor = z.string().trim().min(1, "El nombre es obligatorio").max(120, "Máximo 120 caracteres");
const crearSchema = z.object({
  Tipo: z.enum(TIPOS_CATALOGO_KEYS as [string, ...string[]], { message: "Tipo de catálogo no válido" }),
  /** Uno o varios valores (la importación envía varios). */
  Valores: z.array(valor).min(1).max(200),
  Descripcion: z.string().trim().max(200).optional().default(""),
});

export async function GET() {
  const s = await requirePermiso();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await getItemsCatalogo());
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const s = await requirePermiso(PERMISOS.administrarConfiguracion);
  if (s instanceof NextResponse) return s;
  try {
    const parsed = crearSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const { Tipo, Valores, Descripcion } = parsed.data;

    await ensureSheet(SHEETS.config);
    const items = await getItemsCatalogo();
    const delTipo = items.filter((i) => i.Tipo === Tipo);
    const existentes = new Set(delTipo.map((i) => i.Valor.trim().toLowerCase()));
    let orden = delTipo.reduce((m, i) => Math.max(m, Number(i.Orden) || 0), 0);

    const nuevos: ItemCatalogo[] = [];
    for (const v of Valores) {
      const k = v.toLowerCase();
      if (existentes.has(k)) continue;
      existentes.add(k);
      nuevos.push({ ID: newId("C"), Tipo: Tipo as ItemCatalogo["Tipo"], Valor: v, Descripcion, Orden: String(++orden), Estado: "Activo" });
    }
    if (nuevos.length === 0) {
      return NextResponse.json({ error: Valores.length === 1 ? `"${Valores[0]}" ya existe en la lista.` : "Todos los valores ya existían." }, { status: 409 });
    }
    for (const n of nuevos) await appendRow(SHEETS.config, n as unknown as Record<string, string>);
    return NextResponse.json(nuevos, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
