import Link from "next/link";
import clsx from "clsx";
import { ClipboardList, Ticket } from "lucide-react";
import { auth } from "@/auth";
import { getCatalogos, getLevantamientos, getRequerimientos } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { PERMISOS, can } from "@/lib/api";
import { DataError, PageHeader } from "@/components/ui";
import LevantamientosTable from "@/components/LevantamientosTable";
import RequerimientosBoard from "@/components/RequerimientosBoard";

type Vista = "plataforma" | "registro";

export default async function LevantamientosPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista: v } = await searchParams;
  const vista: Vista = v === "registro" ? "registro" : "plataforma";
  const session = await auth();
  const res = await safeLoad(async () => {
    const [levantamientos, catalogos, requerimientos] = await Promise.all([getLevantamientos(), getCatalogos(), getRequerimientos()]);
    return { levantamientos, catalogos, requerimientos };
  });

  const tabs: { id: Vista; label: string; icon: typeof Ticket; n?: number }[] = [
    { id: "plataforma", label: "Requerimientos plataforma", icon: Ticket, n: res.data?.requerimientos.length },
    { id: "registro", label: "Registro de levantamientos", icon: ClipboardList, n: res.data?.levantamientos.length },
  ];

  return (
    <>
      <PageHeader
        title="Levantamientos"
        subtitle="Requerimientos de la Gobernación de Antioquia: los gestionados en la plataforma y los levantados por el equipo"
      />
      <nav className="mb-6 inline-flex flex-wrap rounded-2xl border border-white/60 bg-white/30 p-1 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.7)] backdrop-blur-xl" aria-label="Vistas de levantamientos">
        {tabs.map(({ id, label, icon: Icon, n }) => (
          <Link
            key={id}
            href={id === "plataforma" ? "/dashboard/levantamientos" : "/dashboard/levantamientos?vista=registro"}
            scroll={false}
            aria-current={vista === id ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
              vista === id ? "bg-white/85 text-ink-900 shadow-sm" : "text-slate-600 hover:bg-white/50",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
            {n !== undefined && (
              <span className={clsx("rounded-full px-1.5 text-[11px] tabular-nums", vista === id ? "bg-brand-50 text-brand-600" : "bg-white/60 text-slate-500")}>{n}</span>
            )}
          </Link>
        ))}
      </nav>

      {res.error !== null ? (
        <DataError message={res.error} />
      ) : vista === "plataforma" ? (
        <RequerimientosBoard items={res.data.requerimientos} />
      ) : (
        <LevantamientosTable
          initial={res.data.levantamientos}
          catalogos={res.data.catalogos}
          canCreate={can(session, PERMISOS.crearLevantamientos)}
          canEdit={can(session, PERMISOS.editarLevantamientos)}
          canDelete={can(session, PERMISOS.eliminarLevantamientos)}
        />
      )}
    </>
  );
}
