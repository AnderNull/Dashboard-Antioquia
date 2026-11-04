import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { findUsuarioByEmail, findUsuarioCached } from "./lib/googleSheets";
import { resolverPermisos } from "./lib/permisos";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

// Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe.
const DUMMY_HASH = bcrypt.hashSync("usuario-inexistente", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * En el servidor (Node) la sesión se revalida contra Usuarios_Autorizados (caché de 30 s):
     * los cambios de rol, permisos o estado que haga un administrador aplican sin volver a iniciar sesión,
     * y un usuario desactivado o eliminado pierde el acceso.
     */
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.uid = user.id;
        token.permisos = user.permisos;
        return token;
      }
      if (!token.uid && !token.email) return token;
      try {
        const u = await findUsuarioCached({ id: token.uid as string | undefined, email: token.email });
        if (!u || u.Estado !== "Activo") return null;
        token.role = u.Rol;
        token.name = u.Nombre;
        token.email = u.Email;
        token.permisos = resolverPermisos(u.Rol, u.Permisos);
      } catch {
        // Si Google Sheets no responde se conserva la sesión tal como estaba.
      }
      return token;
    },
  },
  providers: [
    Credentials({
      credentials: { email: { label: "Email" }, password: { label: "Contraseña", type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await findUsuarioByEmail(email);
        const hash = user?.PasswordHash || DUMMY_HASH;
        const valid = await bcrypt.compare(password, hash);

        if (!user || !valid || user.Estado !== "Activo") return null;
        return {
          id: user.ID,
          name: user.Nombre,
          email: user.Email,
          role: user.Rol,
          permisos: resolverPermisos(user.Rol, user.Permisos),
        };
      },
    }),
  ],
});
