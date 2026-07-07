# Feature 04 - Agenda y Citas

## Epica Jira

**DH-APT - Agenda clinica por profesional y paciente**

## Objetivo

Coordinar citas por clinica, profesional, paciente, tipo de cita, horario y estado operativo.

## Usuarios/personas

- Secretaria/recepcion.
- Odontologo/especialista.
- Administrador de clinica.

## Alcance MVP

- Crear, listar, editar, cancelar y eliminar citas dentro de la clinica activa.
- Configurar tipos de cita por clinica.
- Asociar paciente, profesional/membership, fecha, hora, duracion y descripcion.
- Evitar solapamientos por profesional.
- Estados minimos: programada, confirmada, atendida, cancelada y no asistio.

## Historias MVP

- Como recepcion, quiero crear una cita en menos de un minuto.
- Como recepcion, quiero ver agenda diaria/semanal por profesional.
- Como profesional, quiero ver mis citas y su paciente asociado.
- Como sistema, quiero bloquear citas solapadas del mismo profesional.

## Criterios de aceptacion

- La cita siempre tiene `clinicId` obligatorio.
- El paciente debe pertenecer a la clinica activa.
- El profesional por `professionalMembershipId` o `dentistId` debe tener membership activa.
- El tipo de cita debe pertenecer a la clinica activa.
- Una cita cancelada no bloquea el horario.

## Endpoints/modelos afectados

- `POST /appointments`
- `GET /appointments`
- `GET /appointments/:id`
- `PATCH /appointments/:id`
- `DELETE /appointments/:id`
- `POST /appointments/types`
- `GET /appointments/types/all`
- `Appointment`
- `AppointmentType`

## Escenarios de prueba

- Crear tipo de cita en clinica activa.
- Crear cita con paciente y profesional de la misma clinica.
- Crear cita con paciente de otra clinica devuelve `400`.
- Crear cita con profesional de otra clinica devuelve `400`.
- Crear cita solapada devuelve `400`.
- Usuario sin membership sobre la clinica devuelve `401`.

## Dependencias

- Pacientes.
- Clinicas y equipo.
- Recordatorios.

## Fuera de alcance MVP

- Google Calendar.
- Reserva desde portal del paciente.
- Lista de espera.
- Reglas complejas de disponibilidad.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: confirmaciones automaticas, Google Calendar, boxes y excepciones.
- Fase 3: agenda por sede, reservas desde portal y lista de espera.
- Futuro: optimizacion inteligente y prediccion de ausencias.
