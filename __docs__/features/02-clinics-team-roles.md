# Feature 02 - Clinicas, Equipo y Roles

## Epica Jira

**DH-CLINIC - Gestion de clinica, equipo y membresias**

## Objetivo

Permitir que una clinica configure su informacion basica y administre usuarios internos con roles operativos claros.

## Usuarios/personas

- Owner de clinica.
- Administrador de clinica.
- Odontologo/especialista.
- Secretaria/recepcion.
- Asistente en roadmap.

## Alcance MVP

- Crear clinica y asignar automaticamente al creador como `owner`.
- Listar solo clinicas donde el usuario tiene membership activa.
- Gestionar memberships dentro de la clinica activa.
- Roles MVP: `owner`, `admin`, `odontologist`, `receptionist`.
- Mantener al menos un owner activo por clinica.

## Historias MVP

- Como usuario autenticado, quiero crear una clinica para comenzar la operacion.
- Como owner, quiero invitar/agregar usuarios a mi clinica.
- Como owner/admin, quiero cambiar el rol operativo de un miembro.
- Como owner, quiero desactivar miembros sin perder trazabilidad.
- Como sistema, quiero impedir que una clinica quede sin owner activo.

## Criterios de aceptacion

- `POST /clinics` crea clinica y owner membership en una transaccion.
- `GET /clinics` no muestra clinicas de otros usuarios.
- `clinic-memberships` requiere `x-clinic-id`.
- Solo `owner` y `admin` gestionan equipo.
- No se puede mover una membership a otra clinica via body.
- No se puede desactivar o degradar el ultimo owner activo.

## Endpoints/modelos afectados

- `POST /clinics`
- `GET /clinics`
- `GET /clinics/:id`
- `PATCH /clinics/:id`
- `DELETE /clinics/:id`
- `POST /clinic-memberships`
- `GET /clinic-memberships`
- `PATCH /clinic-memberships/:id`
- `DELETE /clinic-memberships/:id`
- `Clinic`
- `ClinicMembership`

## Escenarios de prueba

- Crear clinica devuelve `201` y crea owner.
- Usuario A no ve clinicas donde no es miembro.
- Owner agrega receptionist.
- Receptionist intenta listar memberships y recibe `403`.
- Intentar eliminar ultimo owner devuelve `400`.

## Dependencias

- Auth.
- Multitenancy y seguridad.

## Fuera de alcance MVP

- Multi-sede.
- Super admin SaaS.
- Invitaciones por email.
- Permisos granulares por accion.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: horarios por profesional, boxes/sillones y permisos por modulo.
- Fase 3: sedes, super admin SaaS, suscripciones y auditoria avanzada.
- Futuro: jerarquias corporativas y configuraciones heredables.
