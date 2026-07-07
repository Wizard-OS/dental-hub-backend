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
- Paciente en Fase 3.
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

- WhatsApp/SMS/email automaticos quedan Fase 2.
- Google Calendar queda Fase 2.
- Pagos online y portal quedan Fase 3.
- Teleconsulta queda Fase 3.
- IA, contabilidad y marketplace quedan Futuro.
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

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: WhatsApp/SMS/email, Google Calendar, exportaciones y formularios.
- Fase 3: portal paciente, pagos online, teleconsulta, suscripciones y multi-sede.
- Futuro: IA clinica/operativa, marketplace, contabilidad, SSO y analitica predictiva.
