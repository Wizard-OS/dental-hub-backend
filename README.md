## Dental Hub Backend (NestJS)

API backend para gestión clínica dental (estilo consultorio) con arquitectura modular en NestJS, PostgreSQL y TypeORM.

## Requisitos

- Node.js 20+
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

```bash
pnpm db:up
```

4. Iniciar API:

```bash
pnpm start:dev
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
- `DATABASE_URL`: URL PostgreSQL completa. Si está definida, tiene prioridad sobre `DB_HOST`, `DB_NAME`, `DB_USERNAME` y `DB_PASSWORD`.
- `DB_HOST`: host PostgreSQL (default `127.0.0.1`)
- `DB_PORT`: puerto PostgreSQL (default `5432`)
- `DB_NAME`: nombre de base (default `DentalHubDB`)
- `DB_USERNAME`: usuario DB (default `postgres`)
- `DB_PASSWORD`: password DB (default `postgres`)
- `DB_SSL`:
  - `false` (o no definido): conexión PostgreSQL sin SSL, útil para Docker local
  - `true`: habilita SSL para Neon, Supabase u otros Postgres administrados
- `DB_SYNCHRONIZE`:
  - `true` (o no definido en desarrollo): habilita `synchronize` para desarrollo local
  - `false`: deshabilita synchronize (recomendado para producción)
- `ENABLE_SEED_ENDPOINT`:
  - `false` (o no definido): deshabilita el endpoint de seed en producción
  - `true`: habilita `GET /api/seed` incluso con `NODE_ENV=production` (solo para entornos controlados)
- `REST_COUNTRIES_BASE_URL`: URL base de Rest Countries v5 (default `https://api.restcountries.com/countries/v5`)
- `REST_COUNTRIES_API_KEY`: API key bearer de Rest Countries. Si no está definida, el backend solo puede servir el fallback local de Uruguay para no romper clínicas existentes.

Nota: en producción se deben aplicar migraciones SQL y mantener `DB_SYNCHRONIZE=false`.

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
JWT_SECRET=<secreto-largo>
INTEGRATION_TOKEN_ENCRYPTION_KEY=<secreto-largo-o-64-hex>
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
https://<tu-servicio>.onrender.com/api/docs
```

## Scripts

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
En producción queda deshabilitado por defecto cuando `NODE_ENV=production`; solo se registra si `ENABLE_SEED_ENDPOINT=true`.

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

## Fases Implementadas

### Fase 1

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

### Fase 2

- Historia clínica (`clinical_records`)
- Notas clínicas (`clinical_notes`)
- Tratamientos (`treatments`)
- Sesiones de tratamiento (`treatment_sessions`)
- Regla de integridad: tratamiento y registro clínico deben pertenecer al mismo paciente
- Validaciones de alcance por clínica en módulos clínicos

### Fase 3

- Plantillas de mensaje (`message_templates`)
- Mensajería saliente (`outbound_messages`)
- Recordatorios (`reminders`)
- Gastos (`expenses`)
- Dashboard operativo/financiero (`/common/dashboard`)
- Migración SQL de fase 3:
  - `src/migrations/202603050002_phase3_ops.sql`

### Hardening Multi-Tenant

- Clínica como tenant obligatorio en pacientes, citas e invoices.
- Unicidad de email/teléfono de paciente por clínica.
- Gestión de equipo scoped por clínica y protección del último owner.
- Migración SQL:
  - `src/migrations/202607060001_multitenancy_scope.sql`

## Internacionalización (i18n)

Implementado con `nestjs-i18n` para respuestas y errores API.

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

## Pruebas E2E

Configuración:

- `__test__/jest-e2e.json`

Specs implementados:

- `__test__/app.e2e-spec.ts`
- `__test__/phase1.e2e-spec.ts`
- `__test__/phase2.e2e-spec.ts`
- `__test__/phase3.e2e-spec.ts`
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
