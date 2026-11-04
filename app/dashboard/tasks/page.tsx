import { auth } from "@/auth";
import { getBloqueos, getCatalogos, getTareas } from "@/lib/googleSheets";
import { safeLoad } from "@/lib/load";
import { PERMISOS, can } from "@/lib/api";
import { DataError, PageHeader } from "@/components/ui";
import KanbanBoard from "@/components/KanbanBoard";

export default async function TasksPage() {
  const session = await auth();
  const res = await safeLoad(async () => {
    const [tareas, bloqueos, catalogos] = await Promise.all([getTareas(), getBloqueos(), getCatalogos()]);
    return { tareas, bloqueos, catalogos };
  });

  return (
    <>
      <PageHeader title="Tablero Kanban y Bloqueos" subtitle="Arrastra las tarjetas entre columnas para actualizar su estado en Google Sheets" />
      {res.error !== null ? (
        <DataError message={res.error} />
      ) : (
        <KanbanBoard
          initialTareas={res.data.tareas}
          initialBloqueos={res.data.bloqueos}
          canEdit={can(session, PERMISOS.editarTareas)}
          canDelete={can(session, PERMISOS.eliminarTareas)}
          canBloqueos={can(session, PERMISOS.gestionarBloqueos)}
          catalogos={res.data.catalogos}
        />
      )}
    </>
  );
}
