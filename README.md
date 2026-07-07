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
- `DB_HOST`: host PostgreSQL (default `127.0.0.1`)
- `DB_PORT`: puerto PostgreSQL (default `5432`)
- `DB_NAME`: nombre de base (default `DentalHubDB`)
- `DB_USERNAME`: usuario DB (default `postgres`)
- `DB_PASSWORD`: password DB (default `postgres`)
- `DB_SYNCHRONIZE`:
  - `true` (o no definido): habilita `synchronize` para desarrollo local
  - `false`: deshabilita synchronize (recomendado para producción)

Nota: en producción se deben aplicar migraciones SQL/TypeORM y mantener `DB_SYNCHRONIZE=false`.

## Scripts
- `pnpm start:dev`: levanta API en modo watch
- `pnpm start:prod`: ejecuta build en `dist`
- `pnpm test:e2e`: corre toda la suite e2e
- `pnpm db:up`: levanta PostgreSQL con Docker
- `pnpm db:down`: baja contenedores
- `pnpm db:logs`: logs de PostgreSQL

## Seed de Datos

Endpoint:
- `GET /seed`

Carga datos de prueba (usuarios, clínicas, membresías, pacientes, agenda, facturación, etc.).

Usuarios seed para login:

- `test1@google.com` / `Abc123` (admin)
- `test2@google.com` / `Abc123`
- `test3@google.com` / `Abc123`

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
