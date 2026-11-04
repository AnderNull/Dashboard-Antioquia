// Se muestra al instante al cambiar de sección mientras el servidor lee Google Sheets.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando sección" className="animate-fade-in">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-64 animate-pulse rounded-lg bg-white/60" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-lg bg-white/45" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass h-32 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="glass h-80 animate-pulse rounded-2xl xl:col-span-2" />
        <div className="glass h-80 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
