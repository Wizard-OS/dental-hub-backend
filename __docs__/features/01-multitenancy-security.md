# Feature 01 - Multitenancy y Seguridad

## Epica Jira

**DH-MT - Aislamiento multi-tenant por clinica y seguridad base**

## Objetivo

Garantizar que cada clinica opere como tenant independiente. Ningun usuario puede ver, crear, modificar o eliminar datos de una clinica donde no tenga `ClinicMembership` activa.

## Usuarios/personas

- Administrador/owner de clinica.
- Odontologo o especialista.
- Secretaria/recepcion.
- Soporte tecnico interno, solo en fases posteriores con super admin SaaS.

## Alcance MVP

- JWT user-scoped sin `clinicId` embebido.
- Header obligatorio `x-clinic-id` para endpoints tenant-owned.
- Validacion de membership activa en cada request scoped.
- Roles por clinica separados de roles globales.
- Respuestas de auth con lista de membresias activas.
- Rechazo de referencias cruzadas entre clinicas.

## Historias MVP

- Como usuario autenticado, quiero ver mis clinicas disponibles para seleccionar el contexto activo.
- Como backend, quiero validar `x-clinic-id` contra memberships activas para aislar datos.
- Como administrador, quiero que las acciones sensibles respeten mi rol dentro de la clinica activa.
- Como QA, quiero probar que un usuario de la clinica A no pueda acceder a la clinica B.

## Criterios de aceptacion

- `x-clinic-id` es requerido y debe ser UUID valido en endpoints scoped.
- Un usuario sin membership activa recibe `401`.
- Un usuario con membership activa pero rol insuficiente recibe `403`.
- `login`, `check-status` y `profile` devuelven `memberships` con `clinicId`, `clinicName`, `membershipId`, `role` y `permissionsJson`.
- Ningun endpoint tenant-owned confia en `clinicId` del body como fuente principal.

## Endpoints/modelos afectados

- `POST /auth/login`
- `GET /auth/check-status`
- `GET /auth/profile`
- `ClinicScopeGuard`
- `ClinicRoleGuard`
- `ClinicMembership`

## Escenarios de prueba

- Login de usuario con una membership activa devuelve una clinica.
- Login de usuario sin membership devuelve array vacio.
- Request scoped sin header devuelve `400`.
- Request scoped con clinicId de otra clinica devuelve `401`.
- Accion owner/admin ejecuta correctamente.
- Accion receptionist sobre equipo devuelve `403`.

## Dependencias

- Auth JWT.
- `clinics`.
- `clinic_memberships`.

## Fuera de alcance MVP

- Super administrador SaaS.
- SSO.
- Auditoria avanzada.
- Politicas enterprise.

## Mejoras previstas

- Permisos por módulo y registro básico de actividad.
- Permisos granulares por sede, profesional, módulo y acción.
- SSO, políticas corporativas, cumplimiento avanzado y auditoría forense.
