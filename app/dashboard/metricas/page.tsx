import { getTareas } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { DataError, PageHeader } from "@/components/ui";
import MetricsBoard from "@/components/MetricsBoard";

export default async function MetricasPage() {
  const res = await safeLoad(getTareas);
  return (
    <>
      <PageHeader title="Métricas y seguimiento" subtitle="Tareas pendientes, programadas, carga por responsable y ejecución en tiempo real" />
      {res.error !== null ? <DataError message={res.error} /> : <MetricsBoard initialTareas={res.data} />}
    </>
  );
}
