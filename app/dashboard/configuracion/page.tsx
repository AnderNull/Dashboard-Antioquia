import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { PERMISOS, can } from "@/lib/api";
import { getItemsCatalogo, getLevantamientos, getTareas } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { TIPOS_CATALOGO_KEYS, type TipoCatalogo } from "@/lib/catalogos";
import { responsables } from "@/lib/metrics";
import { DataError, PageHeader } from "@/components/ui";
import ConfigPanel from "@/components/ConfigPanel";

export default async function ConfiguracionPage() {
  const session = await auth();
  const header = <PageHeader title="Configuración" subtitle="Catálogos que alimentan los desplegables: módulos Taxation, responsables e impacto tributario" />;

  if (!can(session, PERMISOS.administrarConfiguracion)) {
    return (
      <>
        {header}
        <div className="card flex items-start gap-3 p-6 text-sm text-slate-700">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-ink-900">Acceso restringido</p>
            <p className="mt-1">Necesitas el permiso «Administrar configuración». Solicítalo a un administrador.</p>
          </div>
        </div>
      </>
    );
  }

  const res = await safeLoad(async () => {
    const [items, tareas, levantamientos] = await Promise.all([getItemsCatalogo(), getTareas(), getLevantamientos()]);

    // Valores usados en los registros (para contar usos e importar los que falten)
    const valores: Record<TipoCatalogo, string[]> = {
      modulo: [...tareas.map((t) => t.Modulo_Taxation), ...levantamientos.map((l) => l.Modulo_Afectado)],
      responsable: tareas.flatMap((t) => (t.Responsable?.trim() ? responsables(t) : [])),
      impacto: levantamientos.map((l) => l.Impacto_Tributario),
    };
    const uso = {} as Record<TipoCatalogo, Record<string, number>>;
    const usados = {} as Record<TipoCatalogo, string[]>;
    for (const k of TIPOS_CATALOGO_KEYS) {
      const limpios = valores[k].map((v) => (v ?? "").trim()).filter(Boolean);
      uso[k] = {};
      for (const v of limpios) uso[k][v.toLowerCase()] = (uso[k][v.toLowerCase()] ?? 0) + 1;
      usados[k] = [...new Set(limpios)];
    }
    return { items, uso, usados };
  });

  return (
    <>
      {header}
      {res.error !== null ? <DataError message={res.error} /> : <ConfigPanel initialItems={res.data.items} uso={res.data.uso} usados={res.data.usados} />}
    </>
  );
}
