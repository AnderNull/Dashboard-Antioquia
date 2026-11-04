import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Middleware global: cualquier ruta sin sesión válida se redirige a /login.
export default NextAuth(authConfig).auth;

export const config = {
  // Excluye assets estáticos y el endpoint propio de NextAuth.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
