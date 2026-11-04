# Dashboard TAXATION SMART · Project Management

Dashboard de Project Management de **Informática y Tributos** para controlar los desarrollos del proyecto
**TAXATION SMART** de la **Gobernación de Antioquia**.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) + Tailwind CSS 4 |
| UI | Lucide Icons, Recharts |
| Autenticación | NextAuth.js v5 (Credentials + JWT en cookie `httpOnly`), `bcryptjs` |
| Base de datos | Google Sheets API v4 (`googleapis`) con Service Account |
| IA | `@anthropic-ai/sdk` — Claude Sonnet 5.5 con salida estructurada |

## Puesta en marcha

1. **Dependencias**: `npm install`
2. **Variables**: copia `.env.local.example` a `.env.local` y complétalo.
   - `AUTH_SECRET`: `npx auth secret` (o `openssl rand -base64 32`).
   - Google: crea una Service Account en Google Cloud, habilita *Google Sheets API*, descarga la clave JSON y copia
     `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `private_key` → `GOOGLE_PRIVATE_KEY` (entre comillas, con `\n`).
   - **Comparte el Spreadsheet** con el correo de la Service Account como **Editor**.
   - `ANTHROPIC_API_KEY`: clave de la consola de Anthropic. `ANTHROPIC_MODEL` es opcional (por defecto `claude-sonnet-5-5`).
3. **Inicializa la hoja** (crea pestañas + encabezados y un Admin inicial):
   ```bash
   npm run init-sheets -- admin@infortributos.com "Nombre Admin" "ContraseñaSegura"
   ```
4. **Desarrollo**: `npm run dev` → http://localhost:3000

Para agregar usuarios manualmente, genera el hash y pégalo en la columna `PasswordHash`:
```bash
npm run hash-password -- "ContraseñaDelUsuario"
```

## Estructura de Google Sheets

| Pestaña | Columnas |
|---|---|
| `Usuarios_Autorizados` | ID, Nombre, Email, PasswordHash, Rol (Admin / Desarrollador / Gobernacion), Estado (Activo / Inactivo) |
| `Proyectos_Tareas` | ID, Proyecto, Requerimiento/Tarea, Modulo_Taxation, Estado, Prioridad, Responsable, Fecha_Inicio, Fecha_Entrega, Bloqueado, Detalle_Bloqueo, Fecha_Creacion |
| `Levantamientos` | ID, Codigo_Requerimiento, Descripcion_Gobernacion, Modulo_Afectado, Impacto_Tributario, Estado_Aprobacion, Fecha_Levantamiento |
| `Bloqueos_Log` | ID, Tarea_ID, Tipo_Bloqueo, Descripcion_Bloqueo, Fecha_Registro, Fecha_Resolucion, Estado |

El conector (`lib/googleSheets.ts`) mapea columnas por **nombre de encabezado**, así que su orden puede cambiar.
Fechas en formato `AAAA-MM-DD`.

## Vistas

- `/login` — inicio de sesión con alertas de error y redirección al `callbackUrl`.
- `/dashboard` — KPIs (total, completadas, en curso, bloqueos activos) y gráficos por módulo tributario.
- `/dashboard/tasks` — Kanban con arrastrar y soltar, modal de tareas, etiquetas de **Bloqueada** con la causa y
  registro de bloqueos. Al marcar/desmarcar una tarea como bloqueada se escribe automáticamente en `Bloqueos_Log`.
- `/dashboard/levantamientos` — tabla con búsqueda, filtros, orden, edición, cambio rápido de aprobación y exportación CSV.
- `/dashboard/analytics` — diagnóstico de Claude (`POST /api/claude/analysis`): salud del proyecto, responsabilidad
  de bloqueos (equipo técnico vs. Gobernación), métricas de levantamientos y 3 acciones de mitigación.

## Seguridad

- `middleware.ts` protege todas las rutas (páginas y API) y redirige a `/login` sin sesión.
- Sesión JWT cifrada en cookie `httpOnly` (8 h). Contraseñas con bcrypt; usuarios `Inactivo` no pueden ingresar.
- Las API validan sesión **y rol** en el servidor y validan la entrada con Zod.
- Permisos: **Admin** (todo) · **Desarrollador** (crear/editar tareas, gestionar bloqueos, crear levantamientos) ·
  **Gobernacion** (consulta, crear y aprobar levantamientos).
- Las celdas que empiezan por `= + - @` se escapan para evitar inyección de fórmulas en la hoja.
- Encabezados de seguridad (`X-Frame-Options`, `nosniff`, etc.) y protección contra open-redirect en el login.
- `.env.local` está en `.gitignore`: **nunca subas credenciales al repositorio**.
