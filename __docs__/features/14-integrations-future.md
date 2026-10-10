# Feature 14 - Integraciones y Futuro

## Epica Jira

**DH-INT - Integraciones, automatizacion avanzada e innovacion**

## Objetivo

Ordenar el roadmap de integraciones y capacidades avanzadas sin inflar el MVP.

## Usuarios/personas

- Owner de clinica.
- Administrador.
- Recepcion.
- Odontologo.
- Paciente del portal.
- Equipo SaaS/soporte.

## Alcance MVP

- No implementar integraciones externas obligatorias.
- Dejar contratos internos preparados para conectar proveedores despues.
- Registrar datos suficientes para reportes, comunicaciones y auditoria futura.

## Historias MVP

- Como producto, quiero documentar integraciones futuras por fase.
- Como backend, quiero que recordatorios y mensajes salientes tengan estados persistidos.
- Como negocio, quiero separar integraciones premium del core MVP.

## Criterios de aceptacion

- Automatización por WhatsApp/SMS/email y Google Calendar se vinculan con comunicaciones y agenda.
- Pagos online, portal del paciente y teleconsulta se vinculan con servicios para pacientes.
- IA, contabilidad y marketplace se consideran líneas de exploración futura.
- Ninguna integracion externa bloquea operacion MVP.

## Endpoints/modelos afectados

- MVP: `MessageTemplate`, `Reminder`, `OutboundMessage`.
- Futuros:
  - Proveedores de mensajeria.
  - Google Calendar sync.
  - Payment gateway.
  - Video provider.
  - Audit log.
  - AI assistance jobs.

## Escenarios de prueba

- MVP puede operar con recordatorios manuales sin proveedor externo.
- Fallo de proveedor futuro debe registrarse sin romper agenda.
- Pagos manuales siguen funcionando aunque pagos online no este habilitado.

## Dependencias

- Agenda.
- Comunicaciones.
- Pacientes.
- Finanzas.
- Seguridad.
- Auditoria futura.

## Fuera de alcance MVP

- Proveedores externos.
- Jobs asincronicos productivos.
- Webhooks de pago.
- Teleconsulta.
- IA asistiva.

## Mejoras previstas

- WhatsApp/SMS/email, Google Calendar, exportaciones y formularios.
- Portal paciente, pagos online, teleconsulta, suscripciones y multi-sede.
- IA clínica/operativa, marketplace, contabilidad, SSO y analítica predictiva.
