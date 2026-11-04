import { auth } from "@/auth";
import { getLevantamientos } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { PERMISOS, can } from "@/lib/api";
import { DataError, PageHeader } from "@/components/ui";
import LevantamientosTable from "@/components/LevantamientosTable";

export default async function LevantamientosPage() {
  const session = await auth();
  const res = await safeLoad(getLevantamientos);
  return (
    <>
      <PageHeader
        title="Levantamientos de requerimientos"
        subtitle="Requerimientos técnicos y funcionales solicitados por la Gobernación de Antioquia"
      />
      {res.error !== null ? (
        <DataError message={res.error} />
      ) : (
        <LevantamientosTable
          initial={res.data}
          canCreate={can(session, PERMISOS.crearLevantamientos)}
          canEdit={can(session, PERMISOS.editarLevantamientos)}
          canDelete={can(session, PERMISOS.eliminarLevantamientos)}
        />
      )}
    </>
  );
}
