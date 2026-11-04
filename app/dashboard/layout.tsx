import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Sidebar from "@/components/Sidebar";

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
      <main className="min-w-0 flex-1 px-4 pb-10 pt-20 sm:px-8 lg:pt-8">{children}</main>
    </div>
  );
}
