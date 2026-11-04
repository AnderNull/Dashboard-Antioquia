import { SHEETS, appendRow, getBloqueos, newId, today, updateRow } from "./googleSheets";
import type { TipoBloqueo } from "./types";

/**
 * Sincroniza Bloqueos_Log con el estado de bloqueo de una tarea:
 * - Si pasa a bloqueada y no tiene un bloqueo abierto → registra uno nuevo.
 * - Si deja de estar bloqueada → marca como Resuelto sus bloqueos abiertos.
 */
export async function syncBloqueo(opts: {
  tareaId: string;
  bloqueado: boolean;
  descripcion: string;
  tipo?: TipoBloqueo;
}) {
  const abiertos = (await getBloqueos()).filter((b) => b.Tarea_ID === opts.tareaId && b.Estado !== "Resuelto");

  if (opts.bloqueado && abiertos.length === 0) {
    await appendRow(SHEETS.bloqueos, {
      ID: newId("B"),
      Tarea_ID: opts.tareaId,
      Tipo_Bloqueo: opts.tipo ?? "Técnico",
      Descripcion_Bloqueo: opts.descripcion,
      Fecha_Registro: today(),
      Fecha_Resolucion: "",
      Estado: "Abierto",
    });
  } else if (opts.bloqueado && abiertos.length > 0) {
    // Actualiza descripción/tipo del bloqueo vigente si cambiaron
    const b = abiertos[abiertos.length - 1];
    if (b.Descripcion_Bloqueo !== opts.descripcion || (opts.tipo && b.Tipo_Bloqueo !== opts.tipo)) {
      await updateRow(SHEETS.bloqueos, b.ID, {
        Descripcion_Bloqueo: opts.descripcion,
        ...(opts.tipo ? { Tipo_Bloqueo: opts.tipo } : {}),
      });
    }
  } else if (!opts.bloqueado) {
    for (const b of abiertos) {
      await updateRow(SHEETS.bloqueos, b.ID, { Estado: "Resuelto", Fecha_Resolucion: today() });
    }
  }
}
