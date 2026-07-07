# Feature 10 - Recordatorios y Comunicaciones

## Epica Jira

**DH-COMM - Recordatorios y comunicaciones basicas**

## Objetivo

Reducir ausencias y mejorar seguimiento mediante recordatorios manuales o preparados desde la agenda y el historial del paciente.

## Usuarios/personas

- Secretaria/recepcion.
- Administrador de clinica.
- Odontologo.

## Alcance MVP

- Crear plantillas de mensaje por clinica.
- Crear recordatorios asociados a citas.
- Registrar mensajes salientes con payload y estado.
- Estados MVP: programado, enviado, fallido y cancelado.
- Preparar texto base para contacto manual por WhatsApp, telefono o email.
- Mantener trazabilidad por clinica.

## Historias MVP

- Como recepcion, quiero crear un recordatorio para una cita.
- Como recepcion, quiero usar una plantilla de mensaje de la clinica.
- Como sistema, quiero registrar si el mensaje fue enviado o fallo.
- Como administrador, quiero ver recordatorios pendientes en dashboard.

## Criterios de aceptacion

- Plantilla, cita, paciente y mensaje pertenecen a la clinica activa.
- El canal pertenece al enum soportado.
- Un recordatorio no puede apuntar a una cita de otra clinica.
- Un outbound message no puede mezclar paciente, cita o template de otro tenant.
- El MVP no requiere envio automatico real por proveedor.

## Endpoints/modelos afectados

- `POST /message-templates`
- `GET /message-templates`
- `PATCH /message-templates/:id`
- `POST /reminders`
- `GET /reminders`
- `PATCH /reminders/:id`
- `POST /outbound-messages`
- `GET /outbound-messages`
- `MessageTemplate`
- `Reminder`
- `OutboundMessage`

## Escenarios de prueba

- Crear template en clinica activa.
- Crear recordatorio para cita de la clinica.
- Crear outbound message con paciente/template/cita validos.
- Intentar usar cita o template de otra clinica devuelve `400`.
- Actualizar estado a enviado registra metadata.

## Dependencias

- Agenda.
- Pacientes.
- Plantillas.
- Dashboard.

## Fuera de alcance MVP

- Envio automatico real.
- Confirmacion por enlace.
- Preferencias por paciente.
- Campanas inteligentes.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: WhatsApp/SMS/email automaticos, confirmaciones y plantillas configurables.
- Fase 3: automatizaciones por evento y preferencias de comunicacion.
- Futuro: campanas inteligentes por riesgo, deuda o inactividad.
