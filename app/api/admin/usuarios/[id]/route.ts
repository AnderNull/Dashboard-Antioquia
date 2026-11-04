import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PERMISOS, handleError, requirePermiso } from "@/lib/api";
import { SHEETS, deleteRow, ensureHeaders, getUsuarios, invalidarUsuarios, updateRow } from "@/lib/googleSheets";
import { resolverPermisos, serializarPermisos } from "@/lib/permisos";
import { zodMessage } from "@/lib/schemas";
import { editarUsuarioSchema, quedaAdministrador, toPublico } from "@/lib/usuariosAdmin";
import type { Usuario } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.administrarUsuarios);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    const parsed = editarUsuarioSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: zodMessage(parsed.error) }, { status: 400 });
    const d = parsed.data;

    await ensureHeaders(SHEETS.usuarios);
    const usuarios = await getUsuarios();
    const actual = usuarios.find((u) => u.ID === id);
    if (!actual) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (d.Email && usuarios.some((u) => u.ID !== id && u.Email.trim().toLowerCase() === d.Email)) {
      return NextResponse.json({ error: `Ya existe un usuario con el correo ${d.Email}` }, { status: 409 });
    }

    const patch: Partial<Usuario> = {};
    if (d.Nombre !== undefined) patch.Nombre = d.Nombre;
    if (d.Email !== undefined) patch.Email = d.Email;
    if (d.Rol !== undefined) patch.Rol = d.Rol;
    if (d.Estado !== undefined) patch.Estado = d.Estado;
    if (d.Permisos !== undefined) patch.Permisos = serializarPermisos(d.Permisos);
    if ((patch.Rol ?? actual.Rol) === "Admin") patch.Permisos = "";
    if (d.Password) patch.PasswordHash = await bcrypt.hash(d.Password, 10);

    const resultado: Usuario = { ...actual, ...patch };

    // Protecciones contra quedarse sin acceso administrativo
    if (id === s.user.id) {
      if (resultado.Estado !== "Activo") {
        return NextResponse.json({ error: "No puedes desactivar tu propio usuario." }, { status: 400 });
      }
      if (!resolverPermisos(resultado.Rol, resultado.Permisos).includes("usuarios.administrar")) {
        return NextResponse.json({ error: "No puedes quitarte el permiso de administrar usuarios." }, { status: 400 });
      }
    }
    if (!quedaAdministrador(usuarios.map((u) => (u.ID === id ? resultado : u)))) {
      return NextResponse.json({ error: "Debe quedar al menos un administrador activo." }, { status: 400 });
    }

    const saved = await updateRow(SHEETS.usuarios, id, patch as Record<string, string>);
    invalidarUsuarios();
    if (!saved) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json(toPublico(saved as unknown as Usuario));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requirePermiso(PERMISOS.administrarUsuarios);
  if (s instanceof NextResponse) return s;
  try {
    const { id } = await params;
    if (id === s.user.id) return NextResponse.json({ error: "No puedes eliminar tu propio usuario." }, { status: 400 });
    const usuarios = await getUsuarios();
    if (!usuarios.some((u) => u.ID === id)) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!quedaAdministrador(usuarios.filter((u) => u.ID !== id))) {
      return NextResponse.json({ error: "Debe quedar al menos un administrador activo." }, { status: 400 });
    }
    await deleteRow(SHEETS.usuarios, id);
    invalidarUsuarios();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
