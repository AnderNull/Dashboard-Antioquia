import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    permisos?: string[];
  }
  interface Session {
    user: { id: string; role: string; permisos: string[] } & DefaultSession["user"];
  }
}
