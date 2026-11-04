"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

function safeCallback(url: FormDataEntryValue | null) {
  const s = typeof url === "string" ? url : "";
  // Solo rutas internas: evita open-redirect
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        error:
          err.type === "CredentialsSignin"
            ? "Correo o contraseña incorrectos, o el usuario está inactivo."
            : "No fue posible validar las credenciales. Verifica la conexión con Google Sheets.",
      };
    }
    throw err; // redirección de Next.js tras login exitoso
  }
}
