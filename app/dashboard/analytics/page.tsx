import { auth } from "@/auth";
import { PERMISOS, can } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import AnalysisPanel from "@/components/AnalysisPanel";

export default async function AnalyticsPage() {
  const session = await auth();
  return (
    <>
      <PageHeader
        title="Analítica de IA"
        subtitle="Diagnóstico generado por Claude a partir de los datos vigentes en Google Sheets"
      />
      <AnalysisPanel canRun={can(session, PERMISOS.analisisIA)} />
    </>
  );
}
