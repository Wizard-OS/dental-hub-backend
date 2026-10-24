## Dental Hub Backend (NestJS)

API backend para gestión clínica dental (estilo consultorio) con arquitectura modular en NestJS, PostgreSQL y TypeORM.

## Requisitos

- Node.js 22.22.3 or later (below 25)
- pnpm
- Docker Desktop

## Configuración Rápida

1. Crear variables de entorno:

```bash
cp .env.example .env
```

2. Instalar dependencias:

```bash
pnpm install
```

3. Levantar base de datos:

La imagen local es PostgreSQL 18.6. Si ya existe un directorio `postgres` de
PostgreSQL 14, seguir primero la sección de migración de abajo para conservar los
datos; cambiar la imagen no convierte el directorio anterior.

```bash
pnpm db:up
```

4. Iniciar API:

```bash
pnpm start:dev
```

## PostgreSQL local: actualización de 14 a 18.6

Compose conserva las credenciales, el nombre de base, el puerto y el health check
existentes. PostgreSQL 18 usa `./postgres-18:/var/lib/postgresql`; sus archivos
quedan en `postgres-18/18/docker`. El directorio anterior `./postgres` se conserva
para rollback. Esta configuración solo afecta la base Docker local, no las bases
externas de producción.

### Backup y restauración

1. Detener la API y los workers para evitar escrituras durante el backup y el
   cambio de servidor. No ejecutar `start:prod:migrate`, `migrate:sql` ni iniciar
   la API con `DB_SYNCHRONIZE=true` durante esta operación.
2. Conservar el archivo Compose de PostgreSQL 14 y una copia en frío de su
   directorio de datos. Si el servidor estaba detenido, crear el dump desde una
   copia del directorio para dejar el original intacto.
3. Desde el servidor 14, exportar la base en formato custom con `pg_dump
   --format=custom --create` y los roles con `pg_dumpall --globals-only`. Guardar
   los archivos en un directorio privado (`0700`), con permisos `0600` para dumps
   y SQL de roles. El SQL de roles puede incluir hashes de contraseñas.
4. Restaurar primero los roles y después el dump en una instancia desechable de
   `postgres:18.6`, con `psql -v ON_ERROR_STOP=1` y `pg_restore --exit-on-error
   --create --dbname=postgres`. El usuario de inicialización ya existe: omitir
   únicamente su sentencia `CREATE ROLE`, conservando su `ALTER ROLE`, sus grants
   y las demás sentencias. No usar `--no-owner` ni `--no-acl`.
5. Comparar conteos y hashes de filas, secuencias, columnas y nulabilidad,
   extensiones, índices, constraints, triggers, propietarios y permisos.
   PostgreSQL 18 representa los `NOT NULL` en `pg_constraint`; comparar también
   la nulabilidad de las columnas para normalizar esa diferencia de catálogo.
   Un dump creado con el cliente 14 puede dejar los nuevos defaults de `public`:
   restaurar explícitamente el propietario y los grants originales del schema.
6. Solo después de validar el restore, iniciar Compose con el nuevo directorio:

   ```bash
   pnpm db:up
   ```

   En una instalación nueva, Compose crea automáticamente `POSTGRES_DB`. Antes de
   restaurar un dump con `--create`, comprobar que esa base está vacía y eliminar
   únicamente esa base recién inicializada desde una conexión a `postgres`.
   Nunca ejecutar esa eliminación sobre una base que ya contiene datos.
7. Repetir la restauración validada en `dental_hub_db`, verificar los datos y
   recrear el contenedor para comprobar persistencia. Probar la API con
   `DB_SYNCHRONIZE=false`, `BILLING_WORKER_ENABLED=false` y
   `GOOGLE_DRIVE_SYNC_WORKER_ENABLED=false`. Las migraciones pendientes de la
   aplicación se revisan por separado; actualizar PostgreSQL no las aplica.

El backup de esta actualización quedó en `.tmp/postgres-upgrade-20261024/`:
`database.dump`, `globals.sql`, `schema-compatibility.sql`, inventarios de
verificación y `docker-compose.pg14.yaml`. Mantener ese directorio y `postgres`
hasta aceptar la actualización. El reporte de dependencias registra las pruebas
y las limitaciones del schema anterior.

### Rollback de esta actualización

Con la API y los workers detenidos, antes de aceptar nuevas escrituras en 18:

```bash
docker compose stop db
docker compose --project-directory . \
  -f .tmp/postgres-upgrade-20261024/docker-compose.pg14.yaml up -d db
```

El archivo guardado monta `./postgres` con la imagen 14.3. No montar
`postgres-18` en PostgreSQL 14. El rollback vuelve al estado del backup; si ya hubo
escrituras en 18, respaldarlas y planificar su recuperación antes de volver a 14.
Para regresar a 18 después de una prueba de rollback:

```bash
docker compose up -d db
```

## Documentación API (Swagger / OpenAPI)

La API cuenta con documentación interactiva generada con **Swagger (OpenAPI 3.0)**.

### Acceso

| Recurso    | URL                                   |
| ---------- | ------------------------------------- |
| Swagger UI | `http://localhost:3000/api/docs`      |
| JSON spec  | `http://localhost:3000/api/docs-json` |

### Autenticación en Swagger UI

1. **Bearer Token (JWT)**: Haz click en el botón **Authorize** 🔓 en la parte superior de Swagger UI e ingresa tu token JWT (obtenido de `POST /api/auth/login`) en el campo `bearer`.
2. **x-clinic-id**: Para los endpoints que requieren scope de clínica (marcados con el candado `x-clinic-id`), ingresa el UUID de la clínica activa en el campo correspondiente del diálogo Authorize.

### Modelo multi-tenant

- `Clinic` es el tenant del MVP.
- El JWT identifica al usuario; la clínica activa se selecciona con `x-clinic-id`.
- `POST /auth/login`, `GET /auth/check-status` y `GET /auth/profile` retornan `memberships` activas para que el cliente pueda seleccionar clínica.
- Las rutas con datos operativos validan membership activa y rol por clínica antes de leer o modificar datos.
- Los roles globales de `users.roles` no reemplazan el rol de `clinic_memberships`.

### Módulos documentados

- **Auth** — registro, login, perfil, cambio de contraseña, foto de perfil
- **Clinics** — clínicas del usuario autenticado y creación con owner automático
- **Clinic Memberships** — membresías de usuarios en la clínica activa
- **Patients** — CRUD de pacientes (scope clínica)
- **Appointments** — citas y tipos de cita (scope clínica)
- **Invoices** — facturación e ítems (scope clínica)
- **Payments** — pagos parciales/totales (scope clínica)
- **Expenses** — gastos y totales (scope clínica)
- **Clinical Records** — registros clínicos (scope clínica)
- **Clinical Notes** — notas clínicas (scope clínica)
- **Treatments** — tratamientos (scope clínica)
- **Treatment Sessions** — sesiones de tratamiento (scope clínica)
- **Message Templates** — plantillas de mensaje (scope clínica)
- **Outbound Messages** — mensajería saliente (scope clínica)
- **Reminders** — recordatorios (scope clínica)
- **Payment Methods** — métodos de pago del usuario
- **User Sessions** — sesiones activas del usuario
- **Notification Preferences** — preferencias de notificación
- **Help Center** — FAQs, contacto y solicitudes de soporte
- **Common** — dashboard operativo/financiero

## Configuración de Entorno

Variables clave:

- `PORT`: puerto HTTP de la API (default `3000`)
- `CORS_ORIGINS`: origins permitidos separados por coma. En producción, origins no listados son rechazados.
- `TRUST_PROXY_HOPS`: reverse-proxy hops confiables para `request.ip` (default `0`; usar `1` en Render tras verificar IP real y headers en staging).
- `ENABLE_SWAGGER`:
  - `false` (o no definido en producción): no expone `/api/docs`
  - `true`: expone Swagger
- `THROTTLE_TTL_MS` / `THROTTLE_LIMIT`: ventana y límite global de rate limit (defaults `60000` / `120`)
- `DATABASE_URL`: URL PostgreSQL completa. Si está definida, tiene prioridad sobre `DB_HOST`, `DB_NAME`, `DB_USERNAME` y `DB_PASSWORD`.
- `DB_HOST`: host PostgreSQL (default `127.0.0.1` fuera de producción)
- `DB_PORT`: puerto PostgreSQL (default `5432`)
- `DB_NAME`: nombre de base (default `DentalHubDB`)
- `DB_USERNAME`: usuario DB (default `postgres`)
- `DB_PASSWORD`: password DB (default `postgres` fuera de producción)
- `DB_SSL`:
  - `false` (o no definido): conexión PostgreSQL sin SSL, útil para Docker local
  - `true`: habilita SSL con verificación del certificado para Neon, Supabase u otros Postgres administrados. En producción se requiere `DB_SSL=true` o una `DATABASE_URL` con TLS verificado (`sslmode=verify-full`). URLs con `sslmode=disable`, `allow`, `no-verify` o `ssl=0` se rechazan; modos `prefer`, `require` y `verify-ca` se normalizan a `verify-full`.
- `DB_SYNCHRONIZE`:
  - `true`: habilita `synchronize` solo cuando `NODE_ENV !== production`
  - `false` o no definido: deshabilita synchronize
- `ENABLE_SEED_ENDPOINT`:
  - `false` (o no definido): no registra el endpoint de seed
  - `true`: registra `GET /api/seed`, protegido por JWT admin/super-user
- `ENABLE_DEV_OTP`: si `NODE_ENV=development` y vale `true`, `forgot-password` devuelve `devOtp` para pruebas locales.
- `REST_COUNTRIES_BASE_URL`: URL base de Rest Countries v5 (default `https://api.restcountries.com/countries/v5`)
- `REST_COUNTRIES_API_KEY`: API key bearer de Rest Countries. Si no está definida, el backend solo puede servir el fallback local de Uruguay para no romper clínicas existentes.

Nota: en producción se deben aplicar migraciones SQL y mantener `DB_SYNCHRONIZE=false`.
Si no se define `DATABASE_URL`, producción requiere valores explícitos para
`DB_HOST`, `DB_NAME`, `DB_USERNAME` y `DB_PASSWORD`; los valores locales por
defecto solo se usan fuera de producción.

`INTEGRATION_TOKEN_ENCRYPTION_KEY` debe tener al menos 32 bytes. Para generar
una clave aleatoria compatible, usar `openssl rand -hex 32` y conservarla para
poder descifrar los tokens de Google Drive ya guardados.

### País, moneda y prefijo telefónico por clínica

Las clínicas guardan `countryCode`, `countryName`, `currency`, `callingCodes` y `defaultCallingCode`. `countryCode` es el único dato de país editable desde los DTOs; el backend resuelve nombre, moneda y prefijos mediante Rest Countries v5, cachea el catálogo 24 horas y sirve cache stale si la API falla. Las respuestas de auth incluyen esos defaults dentro de `memberships[]` para que el cliente prellene teléfonos de miembros y pacientes.

## Deploy en Render Free con Neon o Supabase

Este backend puede correr como **Render Web Service Free** y usar una base PostgreSQL externa en Neon o Supabase.

Limitaciones importantes del free tier:

- Render Web Services Free comparten 750 horas mensuales por workspace y hacen spin down tras inactividad.
- Render permite solo una Render Postgres Free activa por workspace; usar Neon/Supabase evita ese límite.
- Render Free no conserva archivos locales en `/uploads` después de reinicios, redeploys o spin down. Para archivos persistentes, usar Google Drive u otro storage externo.

Referencias:

- [Render Free](https://render.com/docs/free)
- [Render Web Services](https://render.com/docs/web-services)
- [Supabase Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Neon Postgres](https://neon.com/docs/connect/query-with-psql-editor)

### 1. Preparar la base externa

1. Crear un proyecto PostgreSQL en Neon o Supabase.
2. Copiar los datos de conexión: host, puerto, base, usuario y password.
3. En Neon, usar puerto `5432` y SSL habilitado.
4. En Supabase Free, si la conexión directa IPv6 falla desde Render, usar el pooler/session mode desde el panel de conexión.

### 2. Aplicar migraciones

El backend incluye un runner idempotente para aplicar todos los SQL de
`src/migrations` en orden cronológico contra la base externa. El runner registra
cada archivo en `schema_migrations`, valida checksums y evita ejecuciones
simultáneas con un advisory lock.

```bash
pnpm migrate:sql
```

Usar una `DATABASE_URL` de Neon/Supabase con SSL cuando corresponda, por ejemplo con `sslmode=verify-full`.

### 3. Crear el Web Service en Render

En Render:

1. `New > Web Service`.
2. Conectar el repo.
3. Runtime: `Node`.
4. Instance Type: `Free`.
5. Build Command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm build
```

6. Pre-Deploy Command:

```bash
pnpm migrate:sql
```

7. Start Command:

```bash
pnpm start:prod
```

Si el proveedor no tiene Pre-Deploy Command, usar `pnpm start:prod:migrate`
como Start Command.

No es necesario configurar `PORT`; Render lo provee y `src/main.ts` ya usa `process.env.PORT`.

### 4. Variables de entorno para Render

```env
NODE_ENV=production
DATABASE_URL=postgresql://<user>:<password>@<host-neon-o-supabase>:5432/<database>?sslmode=verify-full
DB_SSL=true
DB_SYNCHRONIZE=false
ENABLE_SEED_ENDPOINT=false
ENABLE_SWAGGER=false
CORS_ORIGINS=https://<tu-frontend>
JWT_SECRET=<secreto-largo>
INTEGRATION_TOKEN_ENCRYPTION_KEY=<salida-de-openssl-rand-hex-32>
REST_COUNTRIES_API_KEY=<api-key-rest-countries>
HOST_API=https://<tu-servicio>.onrender.com/api
```

Recomendado para Neon: configurar `DATABASE_URL` copiando la cadena completa desde el dashboard. Si Neon entrega `sslmode=require`, la app lo normaliza a `sslmode=verify-full` para evitar el warning de `pg`. Si se usan variables separadas en lugar de `DATABASE_URL`, pegar `DB_PASSWORD` sin comillas y sin espacios al principio o final.

`JWT_SECRET` es obligatorio en producción. Se puede generar uno con:

```bash
openssl rand -base64 32
```

### 5. Verificación

Cuando el deploy quede `Live`, probar:

```text
https://<tu-servicio>.onrender.com/api
https://<tu-servicio>.onrender.com/api/docs # solo si ENABLE_SWAGGER=true
```

## Scripts

- `pnpm lint`: revisa TypeScript de la aplicación y de `__test__/`; falla si encuentra errores o warnings.
- `pnpm lint:fix`: aplica las correcciones automáticas disponibles y falla si quedan errores o warnings. Los problemas de tipos inseguros requieren validar los datos y corregir el código.
- `pnpm start:dev`: levanta API en modo watch
- `pnpm start:prod`: ejecuta build en `dist`
- `pnpm test:e2e`: corre toda la suite e2e
- `pnpm db:up`: levanta PostgreSQL con Docker
- `pnpm db:down`: baja contenedores
- `pnpm db:logs`: logs de PostgreSQL

## Seed de Datos

Endpoint:

- `GET /api/seed`

Carga datos de prueba (usuarios, clínicas, membresías, pacientes, agenda, facturación, etc.).
Queda deshabilitado por defecto en todos los entornos; solo se registra si `ENABLE_SEED_ENDPOINT=true` y requiere JWT con rol `admin` o `super-user`.

Usuarios seed para login:

- `test1@google.com` / `Abc123` (admin)
- `test2@google.com` / `Abc123`
- `test3@google.com` / `Abc123`

## Reset de Datos en Producción

Antes de vaciar una base remota de Neon o Supabase usada por Render, crear un backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file backup-before-reset.dump
```

Luego ejecutar el script transaccional:

```bash
psql "$DATABASE_URL" -f scripts/reset-production-data.sql
```

Este reset conserva el schema y vacía los datos operativos. Después, crear el primer usuario con `POST /api/auth/register` y la clínica inicial con `POST /api/clinics`.

## Funciones implementadas

### Clínica, agenda y facturación

- Multi-clínica: `clinics`, `clinic_memberships`
- Scope por clínica vía `x-clinic-id`
- Respuestas de auth con memberships activas
- Roles por clínica mediante `ClinicMembershipRole`
- Agenda base:
  - tipos de cita
  - citas
  - validación de solapamientos y rango horario
- Pacientes
- Facturación:
  - `invoices`
  - `invoice_items`
  - pagos parciales y transición de estado de factura

### Historia clínica y tratamientos

- Historia clínica (`clinical_records`)
- Notas clínicas (`clinical_notes`)
- Tratamientos (`treatments`)
- Sesiones de tratamiento (`treatment_sessions`)
- Regla de integridad: tratamiento y registro clínico deben pertenecer al mismo paciente
- Validaciones de alcance por clínica en módulos clínicos

### Mensajería, recordatorios y gastos

- Plantillas de mensaje (`message_templates`)
- Mensajería saliente (`outbound_messages`)
- Recordatorios (`reminders`)
- Gastos (`expenses`)
- Dashboard operativo/financiero (`/common/dashboard`)
- Migración SQL para mensajería, recordatorios y gastos:
  - `src/migrations/202603050002_messaging_reminders_expenses.sql`

### Hardening Multi-Tenant

- Clínica como tenant obligatorio en pacientes, citas e invoices.
- Unicidad de email/teléfono de paciente por clínica.
- Gestión de equipo scoped por clínica y protección del último owner.
- Migración SQL:
  - `src/migrations/202607060001_multitenancy_scope.sql`

## Internacionalización (i18n)

Implementado con `nestjs-i18n` para mensajes de respuestas API, errores de negocio y validación DTO.

Idiomas soportados:

- `en`
- `es`

Resolución de idioma (orden de prioridad):

1. Query param `lang`
2. Header `x-lang` o `x-custom-lang`
3. Header `Accept-Language`
4. Fallback `en`

Catálogos:

- `src/i18n/en/api.json`
- `src/i18n/es/api.json`
- `src/i18n/en/validation.json`
- `src/i18n/es/validation.json`

Los mensajes que se devuelven al cliente usan claves de catálogo y argumentos de interpolación. Las respuestas exitosas conservan `message` como texto; los errores conservan su estado HTTP y estructura. Los errores de validación se devuelven como una lista plana de mensajes.

## Pruebas E2E

Las respuestas HTTP no tipadas se validan con los lectores de `__test__/support/json-response.ts` antes de acceder a sus campos. Estos lectores reciben `unknown`, verifican los contenedores y los tipos consumidos, e indican la ruta del campo si la respuesta no coincide con lo esperado. No es necesario desactivar las reglas de tipos inseguros ni convertir el cuerpo completo con `as`.

Para comprobar los lectores sin conexión a la base de datos:

```bash
pnpm test --rootDir . --runTestsByPath __test__/support/json-response.spec.ts --runInBand
```

Configuración:

- `__test__/jest-e2e.json`

Specs implementados:

- `__test__/app.e2e-spec.ts`
- `__test__/clinic-care-and-billing.e2e-spec.ts`
- `__test__/clinical-records-and-treatment.e2e-spec.ts`
- `__test__/messaging-reminders-and-expenses.e2e-spec.ts`
- `__test__/i18n.e2e-spec.ts`
- `__test__/multitenancy.e2e-spec.ts`

Ejecución:

```bash
pnpm test:e2e
```

## Troubleshooting

- Puerto ocupado (`EADDRINUSE: :::3000`):

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill -9 <PID>
```

O cambiar `PORT`.

- Error de conexión a DB:
  - confirmar Docker abierto
  - correr `pnpm db:up`
  - validar variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`

- Error de i18n por path:
  - verificar que existan assets de `src/i18n` en build
  - revisar `nest-cli.json` y configuración de carga en `AppModule`
