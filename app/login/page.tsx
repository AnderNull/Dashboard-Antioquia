import { Landmark, ShieldCheck } from "lucide-react";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="grid min-h-screen gap-0 lg:grid-cols-2 lg:p-4">
      <section className="relative hidden overflow-hidden rounded-3xl border glass-dark p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-series-1/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold">Informática y Tributos</p>
            <p className="text-xs text-slate-400">Gobernación de Antioquia</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            TAXATION <span className="text-brand-500">SMART</span>
          </h1>
          <p className="mt-4 text-slate-300">
            Seguimiento de desarrollos, levantamientos de requerimientos y gestión de bloqueos del proyecto tributario
            departamental.
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4" /> Acceso restringido a usuarios autorizados
        </p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="glass w-full max-w-md rounded-3xl p-8 sm:p-10">
          <div className="mb-8 lg:hidden">
            <h1 className="text-2xl font-bold text-ink-900">
              TAXATION <span className="text-brand-600">SMART</span>
            </h1>
            <p className="text-sm text-slate-500">Informática y Tributos · Gobernación de Antioquia</p>
          </div>
          <h2 className="text-2xl font-semibold text-ink-900">Iniciar sesión</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Ingresa con tu correo corporativo autorizado.</p>
          <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
        </div>
      </section>
    </main>
  );
}
