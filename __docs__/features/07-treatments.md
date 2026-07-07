# Feature 07 - Tratamientos

## Epica Jira

**DH-TRT - Planes y sesiones de tratamiento**

## Objetivo

Organizar procedimientos odontologicos en planes de tratamiento, registrar sesiones y conectar avance clinico con presupuestos/pagos.

## Usuarios/personas

- Odontologo/especialista.
- Secretaria/recepcion.
- Administrador de clinica.

## Alcance MVP

- Crear tratamiento por paciente.
- Asociar profesional responsable que pertenezca a la clinica activa.
- Registrar descripcion y precio base.
- Archivar tratamientos sin borrado destructivo.
- Crear sesiones de tratamiento asociadas a historia clinica.
- Validar que tratamiento y record pertenezcan al mismo paciente.

## Historias MVP

- Como odontologo, quiero crear un tratamiento para un paciente.
- Como odontologo, quiero registrar una sesion realizada.
- Como recepcion, quiero ver tratamientos activos para presupuestar o cobrar.
- Como sistema, quiero impedir que un tratamiento use profesionales de otra clinica.

## Criterios de aceptacion

- El paciente pertenece a la clinica activa.
- El `doctorId` tiene membership activa en la clinica activa.
- No se puede crear sesion con tratamiento y record de pacientes distintos.
- `DELETE` archiva el tratamiento (`isActive=false`).
- El listado solo muestra tratamientos del tenant activo.

## Endpoints/modelos afectados

- `POST /treatments`
- `GET /treatments`
- `GET /treatments/:id`
- `PATCH /treatments/:id`
- `DELETE /treatments/:id`
- `POST /treatment-sessions`
- `GET /treatment-sessions`
- `Treatment`
- `TreatmentSession`

## Escenarios de prueba

- Crear tratamiento con paciente/profesional de la misma clinica.
- Crear tratamiento con profesional de otra clinica devuelve `400`.
- Crear sesion con record de otro paciente devuelve `400`.
- Listar tratamientos no mezcla clinicas.

## Dependencias

- Pacientes.
- Clinicas y equipo.
- Historia clinica.
- Odontograma.
- Presupuestos y pagos.

## Fuera de alcance MVP

- Plantillas de planes.
- Etapas avanzadas.
- Aprobacion digital del paciente.
- Recomendaciones asistidas.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: etapas, plantillas y avance porcentual.
- Fase 3: comunicacion/aprobacion del plan desde portal.
- Futuro: recomendaciones por diagnostico y estimaciones predictivas.
