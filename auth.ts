import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { findUsuarioByEmail } from "./lib/googleSheets";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

// Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe.
const DUMMY_HASH = bcrypt.hashSync("usuario-inexistente", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        return { id: user.ID, name: user.Nombre, email: user.Email, role: user.Rol };
      },
    }),
  ],
});
