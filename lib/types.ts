// Tipos de dominio — reflejan 1:1 las columnas de cada pestaña de Google Sheets.

export const ROLES = ["Admin", "Desarrollador", "Gobernacion"] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS_TAREA = ["Por Hacer", "En Progreso", "En Revisión", "Completado"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const PRIORIDADES = ["Alta", "Media", "Baja"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const TIPOS_BLOQUEO = ["Técnico", "Cliente/Gobernación", "Funcional", "Dependencia"] as const;
export type TipoBloqueo = (typeof TIPOS_BLOQUEO)[number];

export const ESTADOS_BLOQUEO = ["Abierto", "En Gestión", "Resuelto"] as const;
export type EstadoBloqueo = (typeof ESTADOS_BLOQUEO)[number];

export const ESTADOS_APROBACION = ["Pendiente", "En Revisión", "Aprobado", "Rechazado"] as const;
export type EstadoAprobacion = (typeof ESTADOS_APROBACION)[number];

export const IMPACTOS = ["Alto", "Medio", "Bajo"] as const;

export interface Usuario {
  ID: string;
  Nombre: string;
  Email: string;
  PasswordHash: string;
  Rol: Rol;
  Estado: "Activo" | "Inactivo";
  /** Vacío = permisos del rol; "ninguno" = sin permisos; lista separada por comas = personalizados. */
  Permisos?: string;
}

/** Usuario sin el hash de contraseña, apto para enviar al navegador. */
export type UsuarioPublico = Omit<Usuario, "PasswordHash">;

export interface Tarea {
  ID: string;
  Proyecto: string;
  "Requerimiento/Tarea": string;
  Modulo_Taxation: string;
  Estado: EstadoTarea;
  Prioridad: Prioridad;
  Responsable: string;
  Fecha_Inicio: string;
  Fecha_Entrega: string;
  Bloqueado: "Sí" | "No";
  Detalle_Bloqueo: string;
  Fecha_Creacion: string;
  /** Descripción o notas detalladas de la actividad. */
  Descripcion?: string;
  /** Fecha real en que se completó (AAAA-MM-DD). */
  Fecha_Finalizacion?: string;
  /** Elementos de la lista de comprobación separados por ";". */
  Checklist?: string;
  /** Avance de la lista de comprobación, p. ej. "1/2". */
  Checklist_Progreso?: string;
  /** Etiquetas separadas por ";". */
  Etiquetas?: string;
  /** De dónde viene la tarea (p. ej. "Planner · Impuesto Vehicular.xlsx"). */
  Origen?: string;
}

export interface Levantamiento {
  ID: string;
  Codigo_Requerimiento: string;
  Descripcion_Gobernacion: string;
  Modulo_Afectado: string;
  Impacto_Tributario: string;
  Estado_Aprobacion: string;
  Fecha_Levantamiento: string;
}

/** Requerimiento de la plataforma de requerimientos de la empresa (pestaña Requerimientos_Plataforma). */
export interface RequerimientoPlataforma {
  ID: string;
  Titulo: string;
  /** Código interno del estado, p. ej. "escalado_a_qa". */
  Estado: string;
  /** Etapa legible: En Desarrollo, En QA, Revisión Director, Resuelto, Cerrado. */
  Etapa: string;
  Cliente: string;
  Producto: string;
  Impuesto: string;
  Modulo: string;
  Asignado_A: string;
  Reportado_Por: string;
  /** inmediata · urgente · alta · normal · baja · ninguna */
  Prioridad: string;
  /** Fechas "AAAA-MM-DD HH:MM" */
  Creado: string;
  Actualizado: string;
  Inicio_Desarrollo: string;
  Ultimo_QA: string;
  Enviado_Comite: string;
  Ultima_Transicion: string;
  /** Días hábiles abiertos según la plataforma (a la fecha del reporte). */
  Dias_Abiertos: string;
  Fecha_Importacion: string;
}

export interface Bloqueo {
  ID: string;
  Tarea_ID: string;
  Tipo_Bloqueo: TipoBloqueo;
  Descripcion_Bloqueo: string;
  Fecha_Registro: string;
  Fecha_Resolucion: string;
  Estado: EstadoBloqueo;
}

/** Módulos sugeridos de TAXATION SMART (el campo admite texto libre). */
export const MODULOS_TAXATION = [
  "Impuesto Vehicular",
  "Registro",
  "Estampillas",
  "Consumo (Licores/Cigarrillos)",
  "Fiscalización",
  "Cobro Coactivo",
  "Recaudo y Pagos",
  "Liquidación",
  "Reportes",
  "Integraciones",
];
