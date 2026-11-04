import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Sidebar from "@/components/Sidebar";
import { GobernacionLogo } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{ name: session.user.name ?? "Usuario", email: session.user.email ?? "", role: session.user.role, permisos: session.user.permisos ?? [] }}
        logoutAction={logout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="relative flex-1 px-4 pb-10 pt-20 sm:px-8 lg:pt-8">
          {/* Logo de la Gobernación: esquina superior derecha, integrado al fondo */}
          <div className="pointer-events-none absolute right-6 top-3 hidden w-40 select-none sm:block lg:right-8 lg:top-4 xl:w-44" aria-hidden>
            <GobernacionLogo />
          </div>
          {children}
        </main>
        {/* Pie institucional */}
        <footer className="flex flex-col items-center justify-between gap-3 px-4 pb-6 sm:flex-row sm:px-8">
          <p className="text-xs text-slate-500">
            Proyecto <span className="font-semibold text-ink-800">TAXATION SMART</span> · Informática y Tributos
          </p>
          <div className="w-32 sm:hidden">
            <GobernacionLogo />
          </div>
          <span className="brand-stripe hidden h-1 w-28 rounded-full opacity-70 sm:block" aria-hidden />
        </footer>
      </div>
    </div>
  );
}
