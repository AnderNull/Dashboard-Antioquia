// Catálogos configurables (pestaña "Configuracion"). Sin dependencias de servidor: lo usa también la UI.
import { IMPACTOS, MODULOS_TAXATION } from "./types";

export const TIPOS_CATALOGO = [
  {
    key: "modulo",
    label: "Módulos Taxation",
    singular: "módulo",
    desc: "Módulos tributarios del sistema. Se usan en tareas, levantamientos, filtros y gráficos.",
    campoDesc: "Descripción (opcional)",
    defaults: MODULOS_TAXATION,
  },
  {
    key: "responsable",
    label: "Responsables",
    singular: "responsable",
    desc: "Personas a las que se asignan tareas. Pueden ser o no usuarios del dashboard.",
    campoDesc: "Cargo, área o correo (opcional)",
    defaults: [] as string[],
  },
  {
    key: "impacto",
    label: "Impacto tributario",
    singular: "nivel de impacto",
    desc: "Niveles de impacto que se asignan a los levantamientos de la Gobernación.",
    campoDesc: "Criterio (opcional)",
    defaults: [...IMPACTOS],
  },
] as const;

export type TipoCatalogo = (typeof TIPOS_CATALOGO)[number]["key"];
export const TIPOS_CATALOGO_KEYS = TIPOS_CATALOGO.map((t) => t.key) as TipoCatalogo[];

export interface ItemCatalogo {
  ID: string;
  Tipo: TipoCatalogo;
  Valor: string;
  Descripcion: string;
  Orden: string;
  Estado: "Activo" | "Inactivo";
}

/** Listas activas, ordenadas, listas para un desplegable. */
export type Catalogos = Record<TipoCatalogo, string[]>;

/**
 * Valores activos de cada catálogo. Si un catálogo aún no tiene elementos en la hoja,
 * se usan los valores por defecto para que la app siga funcionando desde el primer día.
 */
export function construirCatalogos(items: ItemCatalogo[]): Catalogos {
  const out = {} as Catalogos;
  for (const t of TIPOS_CATALOGO) {
    const propios = items.filter((i) => i.Tipo === t.key);
    out[t.key] = propios.length
      ? propios
          .filter((i) => i.Estado !== "Inactivo")
          .sort((a, b) => (Number(a.Orden) || 0) - (Number(b.Orden) || 0) || a.Valor.localeCompare(b.Valor, "es"))
          .map((i) => i.Valor)
      : [...t.defaults];
  }
  return out;
}

/** Opciones de un desplegable conservando el valor actual aunque ya no esté en la lista. */
export function opcionesCon(lista: string[], actual?: string): string[] {
  const v = (actual ?? "").trim();
  return v && !lista.includes(v) ? [v, ...lista] : lista;
}
