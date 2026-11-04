import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GobernacionLogo, TaxationLogo } from "@/components/Brand";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  // Sesión vigente (revalidada contra la hoja) → directo al dashboard
  if ((await auth())?.user) redirect("/dashboard");
  const { callbackUrl } = await searchParams;
  return (
    <main className="grid min-h-screen gap-0 lg:grid-cols-2 lg:p-4">
      <section className="relative hidden overflow-hidden rounded-3xl glass-nav p-12 text-ink-900 lg:flex lg:flex-col lg:justify-between">
        <span className="brand-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden />
        <div className="flex items-start justify-between gap-6">
          <div className="w-72">
            <TaxationLogo priority className="drop-shadow-[0_2px_8px_rgb(30_40_120/0.12)]" />
          </div>
          <div className="w-40 shrink-0">
            <GobernacionLogo />
          </div>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">Project Management</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-ink-900">
            Gestión del proyecto <span className="bg-linear-to-r from-brand-600 via-brand-500 to-gov-500 bg-clip-text text-transparent">tributario departamental</span>
          </h1>
          <p className="mt-4 text-slate-600">
            Seguimiento de desarrollos, levantamientos de requerimientos y gestión de bloqueos de TAXATION SMART.
          </p>
        </div>

        <p className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-gov-600" /> Acceso restringido a usuarios autorizados
        </p>
      </section>

      <section className="flex flex-col items-center justify-center gap-6 p-6">
        <div className="glass relative w-full max-w-md overflow-hidden rounded-3xl p-8 sm:p-10">
          <span className="brand-stripe absolute inset-x-0 top-0 h-1 lg:hidden" aria-hidden />
          <div className="mb-8 lg:hidden">
            <TaxationLogo priority className="mx-auto max-w-[240px]" />
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">Iniciar sesión</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Ingresa con tu correo corporativo autorizado.</p>
          <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
        </div>
        <div className="w-40 lg:hidden">
          <GobernacionLogo />
        </div>
      </section>
    </main>
  );
}
