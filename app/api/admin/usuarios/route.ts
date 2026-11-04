import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, appendRow, ensureHeaders, getUsuarios, invalidarUsuarios } from "@/lib/googleSheets";
import { serializarPermisos } from "@/lib/permisos";
import { zodMessage } from "@/lib/schemas";
import { crearUsuarioSchema, siguienteId, toPublico } from "@/lib/usuariosAdmin";
import type { Usuario } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await requirePermiso(PERMISOS.administrarUsuarios);
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json((await getUsuarios()).map(toPublico));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const s = await requirePermiso(PERMISOS.administrarUsuarios);
  if (s instanceof NextResponse) return s;
  try {
    const parsed = crearUsuarioSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const d = parsed.data;

    await ensureHeaders(SHEETS.usuarios);
    const usuarios = await getUsuarios();
    if (usuarios.some((u) => u.Email.trim().toLowerCase() === d.Email)) {
      return NextResponse.json({ error: `Ya existe un usuario con el correo ${d.Email}` }, { status: 409 });
    }

    const nuevo: Usuario = {
      ID: siguienteId(usuarios),
      Nombre: d.Nombre,
      Email: d.Email,
      PasswordHash: await bcrypt.hash(d.Password, 10),
      Rol: d.Rol,
      Estado: d.Estado,
      Permisos: d.Rol === "Admin" ? "" : serializarPermisos(d.Permisos),
    };
    await appendRow(SHEETS.usuarios, nuevo as unknown as Record<string, string>);
    invalidarUsuarios();
    return NextResponse.json(toPublico(nuevo), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
