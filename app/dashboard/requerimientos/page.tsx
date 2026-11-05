import { getRequerimientos } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { DataError, PageHeader } from "@/components/ui";
import RequerimientosBoard from "@/components/RequerimientosBoard";

export default async function RequerimientosPage() {
  const res = await safeLoad(getRequerimientos);
  return (
    <>
      <PageHeader
        title="Requerimientos de la plataforma"
        subtitle="Solicitudes de la Gobernación de Antioquia registradas en la plataforma de requerimientos de Informática y Tributos"
      />
      {res.error !== null ? <DataError message={res.error} /> : <RequerimientosBoard items={res.data} />}
    </>
  );
}
