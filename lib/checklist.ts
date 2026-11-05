// Lista de comprobación de una tarea (columna "Checklist" de Proyectos_Tareas).
// Formato actual: JSON [{"t":"texto","d":true}]. También entiende el formato importado de
// Microsoft Planner ("elemento 1;elemento 2" + Checklist_Progreso "1/2").

export interface ItemChecklist {
  texto: string;
  hecho: boolean;
}

export function leerChecklist(raw?: string, progreso?: string): ItemChecklist[] {
  const v = (raw ?? "").trim();
  if (!v) return [];
  if (v.startsWith("[")) {
    try {
      const arr = JSON.parse(v) as { t?: unknown; d?: unknown }[];
      if (Array.isArray(arr)) {
        return arr
          .map((x) => ({ texto: String(x?.t ?? "").trim(), hecho: x?.d === true }))
          .filter((x) => x.texto);
      }
    } catch {
      /* si no es JSON válido se trata como texto plano */
    }
  }
  // Formato Planner: no indica cuáles están hechos, solo cuántos; se marcan los primeros N.
  const items = v.split(";").map((s) => s.trim()).filter(Boolean);
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec((progreso ?? "").trim());
  const hechos = m ? Math.min(Number(m[1]), items.length) : 0;
  return items.map((texto, i) => ({ texto, hecho: i < hechos }));
}

export function serializarChecklist(items: ItemChecklist[]): string {
  const limpios = items.map((i) => ({ t: i.texto.trim(), d: i.hecho })).filter((i) => i.t);
  return limpios.length ? JSON.stringify(limpios) : "";
}

export function progresoChecklist(items: ItemChecklist[]): string {
  const validos = items.filter((i) => i.texto.trim());
  return validos.length ? `${validos.filter((i) => i.hecho).length}/${validos.length}` : "";
}
