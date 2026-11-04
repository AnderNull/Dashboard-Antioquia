import { AlertTriangle } from "lucide-react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex min-h-[5.5rem] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:pr-48 xl:pr-52">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <div className="card flex items-start gap-3 !border-amber-200/80 !bg-amber-50/70 p-5 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">No fue posible cargar los datos de Google Sheets</p>
        <p className="mt-1">{message}</p>
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/25 p-4 backdrop-blur-md animate-fade-in sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-strong rounded-3xl animate-modal-in my-8 w-full ${wide ? "max-w-2xl" : "max-w-lg"} p-6`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/70 hover:text-slate-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
