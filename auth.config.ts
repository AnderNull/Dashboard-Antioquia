import type { NextAuthConfig } from "next-auth";

/**
 * Configuración compatible con Edge (sin bcrypt ni googleapis).
 * La usa el middleware; `auth.ts` la extiende con el proveedor de credenciales.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // jornada laboral de 8 h
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLogin = nextUrl.pathname.startsWith("/login");
      // /login siempre es accesible: la propia página redirige si la sesión sigue vigente
      // (así un usuario desactivado no queda en un bucle de redirecciones).
      if (isLogin) return true;
      return isLoggedIn; // false => redirige a /login?callbackUrl=...
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.uid = user.id;
        token.permisos = user.permisos;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.uid as string;
        session.user.permisos = (token.permisos as string[] | undefined) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
