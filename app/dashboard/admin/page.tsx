import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { PERMISOS, can } from "@/lib/api";
import { getUsuarios } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { toPublico } from "@/lib/usuariosAdmin";
import { DataError, PageHeader } from "@/components/ui";
import AdminUsuarios from "@/components/AdminUsuarios";

export default async function AdminPage() {
  const session = await auth();
  const header = <PageHeader title="Administración" subtitle="Usuarios autorizados, roles y permisos de acceso al dashboard" />;

  if (!can(session, PERMISOS.administrarUsuarios)) {
    return (
      <>
        {header}
        <div className="card flex items-start gap-3 p-6 text-sm text-slate-700">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-ink-900">Acceso restringido</p>
            <p className="mt-1">Necesitas el permiso «Administrar usuarios y permisos». Solicítalo a un administrador.</p>
          </div>
        </div>
      </>
    );
  }

  const res = await safeLoad(async () => (await getUsuarios()).map(toPublico));
  return (
    <>
      {header}
      {res.error !== null ? (
        <DataError message={res.error} />
      ) : (
        <AdminUsuarios initialUsuarios={res.data} currentUserId={session!.user.id} />
      )}
    </>
  );
}
