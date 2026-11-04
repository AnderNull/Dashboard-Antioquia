import { PageHeader } from "@/components/ui";
import AnalysisPanel from "@/components/AnalysisPanel";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analítica de IA"
        subtitle="Diagnóstico generado por Claude a partir de los datos vigentes en Google Sheets"
      />
      <AnalysisPanel />
    </>
  );
}
