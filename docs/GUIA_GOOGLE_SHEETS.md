# Guía paso a paso: configurar Google Sheets como base de datos

Esta guía explica cómo crear el Spreadsheet, darle acceso a la aplicación y cómo deben estar
construidas cada pestaña y cada columna para que el dashboard lea y escriba correctamente.

---

## Parte 1 · Crear el Spreadsheet

1. Entra a <https://sheets.google.com> con la cuenta corporativa y crea una **hoja en blanco**.
2. Ponle un nombre, por ejemplo `TAXATION SMART - Project Management` (el nombre del archivo es libre).
3. Copia el **ID del Spreadsheet** desde la URL. Es el texto entre `/d/` y `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0
                                          └──────────── ESTE ES EL ID ────────────┘
   ```

4. Guárdalo; irá en `GOOGLE_SHEETS_SPREADSHEET_ID`.

---

## Parte 2 · Crear la Service Account (la "cuenta robot" de la app)

La aplicación no usa tu usuario de Google: usa una **Service Account** con su propia clave.

1. Entra a <https://console.cloud.google.com>.
2. Arriba, en el selector de proyectos, pulsa **Nuevo proyecto** → nombre `taxation-smart-dashboard` → **Crear**.
   Asegúrate de que quede seleccionado.
3. Habilita la API: menú ☰ → **APIs y servicios** → **Biblioteca** → busca **Google Sheets API** → **Habilitar**.
4. Crea la cuenta: ☰ → **IAM y administración** → **Cuentas de servicio** → **+ Crear cuenta de servicio**.
   - Nombre: `dashboard-sheets`
   - Pulsa **Crear y continuar**. Los pasos de "roles" y "acceso de usuarios" son opcionales: pulsa **Listo**.
5. Abre la cuenta recién creada → pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → **Crear**.
   Se descarga un archivo `.json`. **Trátalo como una contraseña**: no lo subas a Git ni lo compartas por chat.

   > Si tu organización bloquea la creación de claves (política `iam.disableServiceAccountKeyCreation`),
   > pide a un administrador de Google Workspace que la permita para este proyecto.

6. Abre el JSON con un editor de texto. Solo necesitas dos campos:

   ```json
   {
     "client_email": "dashboard-sheets@taxation-smart-dashboard.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
   }
   ```

---

## Parte 3 · Compartir el Spreadsheet con la Service Account

Este es el paso que más se olvida.

1. Abre el Spreadsheet → botón **Compartir**.
2. Pega el `client_email` de la Service Account.
3. Dale permiso de **Editor** (la app necesita escribir) y desmarca "Notificar a las personas".
4. **Compartir**.

Sin esto, la app responde con un error de permisos (403).

---

## Parte 4 · Configurar `.env.local`

Edita el archivo `.env.local` en la raíz del proyecto:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
GOOGLE_SERVICE_ACCOUNT_EMAIL=dashboard-sheets@taxation-smart-dashboard.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

Reglas para `GOOGLE_PRIVATE_KEY`:

- Copia el valor de `private_key` **tal cual aparece en el JSON**, con los `\n` literales, en **una sola línea**.
- Ponlo **entre comillas dobles**.
- Debe incluir `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`.
- La app convierte los `\n` en saltos de línea reales al leerla.

---

## Parte 5 · Crear las pestañas

Hay dos caminos. **Recomendado: el automático.**

### Opción A · Automática (recomendada)

Con `.env.local` completo, ejecuta en la carpeta del proyecto:

```bash
npm run init-sheets -- tu-correo@infortributos.com "Tu Nombre" "ContraseñaSegura123"
```

El script:

1. Crea las 4 pestañas si no existen.
2. Escribe los encabezados en la fila 1 de cada una (si está vacía).
3. Crea tu usuario **Admin** con la contraseña cifrada (bcrypt).

Si todo sale bien verás `Listo ✔`. Puedes borrar la pestaña `Hoja 1` que crea Google por defecto.

### Opción B · Manual

1. Crea 4 pestañas (clic en **+** abajo a la izquierda, doble clic para renombrar) con estos nombres
   **exactos** — mayúsculas, guion bajo, sin espacios ni tildes:

   | Pestaña |
   |---|
   | `Usuarios_Autorizados` |
   | `Proyectos_Tareas` |
   | `Levantamientos` |
   | `Bloqueos_Log` |

2. En la **fila 1** de cada pestaña escribe los encabezados de la Parte 6, uno por columna, desde la columna A.
3. O importa las plantillas de la carpeta `plantillas/` (ver Parte 7).

---

## Parte 6 · Estructura de cada pestaña

Reglas generales que aplican a **todas** las pestañas:

- **Fila 1 = encabezados.** La app ubica cada dato por el **nombre del encabezado**, no por la posición:
  puedes reordenar columnas, pero el texto del encabezado debe ser idéntico (incluidas tildes y la barra `/`).
- **Fila 2 en adelante = un registro por fila.** Las filas vacías se ignoran.
- **Columna `ID` única** en cada pestaña. La app genera IDs automáticamente (`T-…`, `L-…`, `B-…`);
  si cargas datos a mano, usa cualquier código que no se repita (`T-001`, `T-002`…).
- **Fechas en formato `AAAA-MM-DD`** (ej. `2026-11-04`). Ver la nota sobre fechas más abajo.
- Los valores de las listas (Estado, Prioridad, Rol…) deben escribirse **exactamente** como se indica,
  respetando mayúsculas y tildes. Se recomienda usar validación de datos (Parte 8).

### 6.1 `Usuarios_Autorizados` — quién puede entrar

| Columna | Obligatoria | Valores permitidos / formato | Ejemplo |
|---|---|---|---|
| `ID` | Sí | Código único | `U-001` |
| `Nombre` | Sí | Texto libre (se muestra en el sidebar) | `Ana María Gómez` |
| `Email` | Sí | Correo con el que inicia sesión (no distingue mayúsculas) | `agomez@infortributos.com` |
| `PasswordHash` | Sí | Hash bcrypt generado con `npm run hash-password` — **nunca la contraseña en texto plano** | `$2b$12$Qx…` |
| `Rol` | Sí | `Admin` · `Desarrollador` · `Gobernacion` (**sin tilde**) | `Desarrollador` |
| `Estado` | Sí | `Activo` · `Inactivo` | `Activo` |

**Agregar un usuario nuevo:**

```bash
npm run hash-password -- "ContraseñaDelUsuario"
```

Copia el resultado (empieza por `$2b$12$`) y pégalo en `PasswordHash` de una fila nueva.
Para bloquear a alguien sin borrarlo, cambia `Estado` a `Inactivo`.

**Qué puede hacer cada rol:**

| Acción | Admin | Desarrollador | Gobernacion |
|---|:-:|:-:|:-:|
| Ver Overview, Kanban, Levantamientos, Analítica | ✔ | ✔ | ✔ |
| Crear / editar / mover tareas | ✔ | ✔ | — |
| Cambiar estado de bloqueos | ✔ | ✔ | — |
| Eliminar tareas | ✔ | — | — |
| Crear levantamientos | ✔ | ✔ | ✔ |
| Editar / aprobar levantamientos | ✔ | — | ✔ |
| Eliminar levantamientos | ✔ | — | — |
| Generar análisis IA | ✔ | ✔ | ✔ |

### 6.2 `Proyectos_Tareas` — el tablero Kanban

| Columna | Obligatoria | Valores permitidos / formato | Ejemplo |
|---|---|---|---|
| `ID` | Sí | Código único | `T-001` |
| `Proyecto` | No | Texto (por defecto `TAXATION SMART`) | `TAXATION SMART` |
| `Requerimiento/Tarea` | Sí | Descripción de la tarea (con la barra `/` en el encabezado) | `Ajustar liquidación de impuesto vehicular 2026` |
| `Modulo_Taxation` | Sí | Texto. Sugeridos: `Impuesto Vehicular`, `Registro`, `Estampillas`, `Consumo (Licores/Cigarrillos)`, `Fiscalización`, `Cobro Coactivo`, `Recaudo y Pagos`, `Liquidación`, `Reportes`, `Integraciones` | `Impuesto Vehicular` |
| `Estado` | Sí | `Por Hacer` · `En Progreso` · `En Revisión` · `Completado` | `En Progreso` |
| `Prioridad` | Sí | `Alta` · `Media` · `Baja` | `Alta` |
| `Responsable` | No | Nombre de la persona | `Carlos Pérez` |
| `Fecha_Inicio` | No | `AAAA-MM-DD` | `2026-10-01` |
| `Fecha_Entrega` | No | `AAAA-MM-DD` (si ya pasó y no está completada, se marca vencida) | `2026-11-15` |
| `Bloqueado` | Sí | `Sí` (con tilde) · `No` | `No` |
| `Detalle_Bloqueo` | Si `Bloqueado = Sí` | Causa del bloqueo | `Pendiente tarifas 2026 de la Gobernación` |
| `Fecha_Creacion` | No | `AAAA-MM-DD` (la app la llena sola) | `2026-09-28` |

> El **módulo** alimenta el gráfico "Avance por módulo tributario": usa siempre el mismo nombre
> para el mismo módulo (`Impuesto Vehicular` y `Impuesto vehicular` contarían como dos módulos distintos).

### 6.3 `Levantamientos` — requerimientos de la Gobernación

| Columna | Obligatoria | Valores permitidos / formato | Ejemplo |
|---|---|---|---|
| `ID` | Sí | Código único | `L-001` |
| `Codigo_Requerimiento` | Sí | Código del requerimiento | `REQ-GOB-001` |
| `Descripcion_Gobernacion` | Sí | Lo que solicita la Gobernación | `Incluir descuento por pronto pago en vehículos` |
| `Modulo_Afectado` | Sí | Mismos nombres de módulo que en tareas | `Impuesto Vehicular` |
| `Impacto_Tributario` | No | Sugeridos: `Alto` · `Medio` · `Bajo` (acepta texto libre) | `Alto` |
| `Estado_Aprobacion` | Sí | `Pendiente` · `En Revisión` · `Aprobado` · `Rechazado` | `Pendiente` |
| `Fecha_Levantamiento` | No | `AAAA-MM-DD` (si queda vacía, la app pone la de hoy) | `2026-10-20` |

### 6.4 `Bloqueos_Log` — historial de bloqueos

**Normalmente no se edita a mano**: la app escribe aquí automáticamente cuando marcas una tarea como bloqueada
en el Kanban, y cierra el registro cuando la desbloqueas.

| Columna | Obligatoria | Valores permitidos / formato | Ejemplo |
|---|---|---|---|
| `ID` | Sí | Código único | `B-001` |
| `Tarea_ID` | Sí | Debe coincidir con un `ID` de `Proyectos_Tareas` | `T-003` |
| `Tipo_Bloqueo` | Sí | `Técnico` · `Cliente/Gobernación` · `Funcional` · `Dependencia` | `Cliente/Gobernación` |
| `Descripcion_Bloqueo` | Sí | Detalle del bloqueo | `Sin respuesta sobre tarifas 2026` |
| `Fecha_Registro` | Sí | `AAAA-MM-DD` | `2026-10-25` |
| `Fecha_Resolucion` | No | `AAAA-MM-DD` (vacía mientras siga abierto) | |
| `Estado` | Sí | `Abierto` · `En Gestión` · `Resuelto` | `Abierto` |

El `Tipo_Bloqueo` es clave para la analítica de IA: `Técnico` y `Dependencia` se atribuyen al equipo;
`Cliente/Gobernación` a la Gobernación; `Funcional` se evalúa según la descripción.

### Nota importante sobre las fechas

Google Sheets convierte automáticamente lo que escribes a mano como fecha según el idioma de la hoja
(por ejemplo `2026-11-04` se puede mostrar como `4/11/2026`). La app lee el **texto que se ve en la celda**,
así que ese cambio rompe el cálculo de tareas vencidas y los filtros.

Para evitarlo, en cada pestaña selecciona las columnas de fecha y aplica
**Formato → Número → Texto sin formato** *antes* de escribir. O bien deja el formato de fecha
pero con el patrón personalizado `aaaa-mm-dd` (**Formato → Número → Fecha y hora personalizadas**).

Lo que la app escribe por sí misma ya queda como texto `AAAA-MM-DD`, sin este problema.

---

## Parte 7 · Cargar datos iniciales con las plantillas CSV

En la carpeta `plantillas/` hay un CSV por pestaña con los encabezados correctos y filas de ejemplo.

1. Abre la pestaña de destino (ya creada, con el nombre exacto).
2. **Archivo → Importar → Subir** y elige el CSV correspondiente.
3. En "Ubicación de importación" elige **Reemplazar hoja actual**.
4. Tipo de separador: **Coma**.
5. **Desmarca** "Convertir texto en números, fechas y fórmulas" (así las fechas quedan como `AAAA-MM-DD`).
6. **Importar datos**.

> `Usuarios_Autorizados.csv` trae solo los encabezados: los usuarios se crean con `npm run init-sheets`
> o con `npm run hash-password`, porque las contraseñas deben ir cifradas.
> Las filas de ejemplo de tareas, levantamientos y bloqueos son ficticias: bórralas cuando cargues los datos reales.

---

## Parte 8 · (Opcional, recomendado) Listas desplegables

Evitan errores de escritura en los campos con valores fijos.

1. Selecciona la columna (por ejemplo `E2:E` de `Proyectos_Tareas`, la columna `Estado`).
2. **Datos → Validación de datos → Agregar regla**.
3. Criterio: **Menú desplegable** → escribe cada opción.
4. En "Si los datos no son válidos" elige **Rechazar la entrada**.

| Pestaña | Columna | Opciones |
|---|---|---|
| `Usuarios_Autorizados` | `Rol` | `Admin`, `Desarrollador`, `Gobernacion` |
| `Usuarios_Autorizados` | `Estado` | `Activo`, `Inactivo` |
| `Proyectos_Tareas` | `Estado` | `Por Hacer`, `En Progreso`, `En Revisión`, `Completado` |
| `Proyectos_Tareas` | `Prioridad` | `Alta`, `Media`, `Baja` |
| `Proyectos_Tareas` | `Bloqueado` | `Sí`, `No` |
| `Levantamientos` | `Estado_Aprobacion` | `Pendiente`, `En Revisión`, `Aprobado`, `Rechazado` |
| `Bloqueos_Log` | `Tipo_Bloqueo` | `Técnico`, `Cliente/Gobernación`, `Funcional`, `Dependencia` |
| `Bloqueos_Log` | `Estado` | `Abierto`, `En Gestión`, `Resuelto` |

Otras recomendaciones:

- **Ver → Inmovilizar → 1 fila** para que los encabezados queden fijos.
- **Datos → Proteger hojas y rangos** sobre la fila 1, para que nadie cambie los encabezados por error.
- Protege la pestaña `Usuarios_Autorizados` para que solo los administradores la editen.

---

## Parte 9 · Cómo extrae la app la información

Para entender qué pasa por debajo (código en `lib/googleSheets.ts`):

1. **Autenticación**: con `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` la app obtiene un token
   de Google con permiso sobre Sheets.
2. **Lectura**: pide el rango `A:Z` de la pestaña, toma la fila 1 como nombres de campo y convierte cada fila
   siguiente en un objeto, por ejemplo:

   ```json
   { "ID": "T-001", "Estado": "En Progreso", "Modulo_Taxation": "Impuesto Vehicular", "Bloqueado": "No" }
   ```

3. **Escritura**:
   - *Crear*: agrega una fila al final, ordenando los valores según los encabezados actuales.
   - *Editar*: busca la fila por `ID` y reescribe esa fila completa.
   - *Eliminar*: busca la fila por `ID` y la borra.
   - Los textos que empiezan por `=`, `+`, `-` o `@` se guardan con un apóstrofo delante para que la hoja
     no los ejecute como fórmula.
4. **Qué pestaña usa cada pantalla:**

   | Pantalla | Lee | Escribe |
   |---|---|---|
   | Login | `Usuarios_Autorizados` | — |
   | Overview | `Proyectos_Tareas`, `Levantamientos`, `Bloqueos_Log` | — |
   | Kanban y Bloqueos | `Proyectos_Tareas`, `Bloqueos_Log` | ambas |
   | Levantamientos | `Levantamientos` | `Levantamientos` |
   | Analítica IA | las tres de datos (se envían a Claude) | — |

5. Los datos se leen **en cada carga de página**: si editas la hoja directamente, basta con recargar el navegador.

---

## Parte 10 · Verificación final

1. `npm run init-sheets` (o con los argumentos del Admin) termina en `Listo ✔`.
2. `npm run dev` y abre <http://localhost:3000>.
3. Inicia sesión con el usuario Admin.
4. Crea una tarea de prueba en **Kanban** y comprueba que aparece como fila nueva en `Proyectos_Tareas`.
5. Márcala como bloqueada y comprueba que aparece un registro en `Bloqueos_Log`.

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Login: "No fue posible validar las credenciales. Verifica la conexión con Google Sheets." | Faltan variables o la hoja no está compartida | Revisa la Parte 3 y la Parte 4; reinicia `npm run dev` tras editar `.env.local` |
| "Correo o contraseña incorrectos" con datos correctos | `PasswordHash` en texto plano, `Estado` ≠ `Activo`, o espacios en el email | Regenera el hash con `npm run hash-password`; revisa `Estado` |
| Error 403 / `The caller does not have permission` | Spreadsheet no compartido con la Service Account | Compártelo como **Editor** con el `client_email` |
| `Unable to parse range` o "La pestaña … no existe" | Nombre de pestaña distinto | Renombra exactamente: `Proyectos_Tareas`, etc. |
| `error:1E08010C:DECODER routines` o `invalid_grant` | `GOOGLE_PRIVATE_KEY` mal copiada | Una sola línea, entre comillas dobles, con los `\n` literales |
| `Google Sheets API has not been used in project…` | API no habilitada | Parte 2, paso 3 |
| Una columna sale vacía en la app | Encabezado escrito distinto (tilde, espacio, mayúscula) | Corrige el texto exacto de la fila 1 |
| Tareas vencidas mal calculadas | Fechas convertidas al formato local | Nota sobre fechas (Parte 6) |
