# Feature 13 - Portal del Paciente

## Epica Jira

**DH-PORTAL - Portal paciente para citas, presupuestos y pagos**

## Objetivo

Permitir que pacientes realicen acciones clave sin depender siempre de recepcion, manteniendo acceso exclusivo a su propia informacion.

## Usuarios/personas

- Paciente.
- Recepcion.
- Administrador de clinica.
- Odontologo.

## Alcance MVP

- No incluido.
- El backend MVP debe modelar pacientes, citas, invoices y pagos de forma que el portal pueda agregarse despues.
- Los datos sensibles deben quedar aislados por clinica desde la base.

## Historias MVP

- Como producto, quiero dejar el portal fuera del MVP para proteger foco.
- Como backend, quiero que los datos clinicos y financieros tengan relaciones claras para exponerlos luego al paciente.
- Como seguridad, quiero que la futura autenticacion de paciente no se mezcle con usuarios internos.

## Criterios de aceptacion

- Ningun endpoint publico expone datos clinicos de paciente.
- Las relaciones paciente-cita-invoice-pago estan listas para consultas futuras.
- La documentacion declara portal como Fase 3.

## Endpoints/modelos afectados

- Sin endpoints MVP.
- Endpoints futuros sugeridos:
  - `POST /patient-auth/login`
  - `GET /patient-portal/me/appointments`
  - `GET /patient-portal/me/estimates`
  - `POST /patient-portal/me/estimates/:id/accept`
  - `POST /patient-portal/me/payments`

## Escenarios de prueba

- Verificar que endpoints actuales requieren JWT interno y/o `x-clinic-id`.
- En Fase 3, paciente A no ve informacion de paciente B.
- En Fase 3, paciente solo ve documentos compartidos explicitamente.

## Dependencias

- Pacientes.
- Agenda.
- Presupuestos/invoices.
- Pagos.
- Seguridad y auditoria.

## Fuera de alcance MVP

- Cuentas de paciente.
- Aprobacion digital.
- Pago online.
- Autogestion de datos.
- Comunicacion bidireccional.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: formularios o enlaces especificos sin portal completo.
- Fase 3: citas, presupuestos, pagos online, aprobaciones y datos personales limitados.
- Futuro: seguimiento de tratamientos, material educativo y mensajeria bidireccional.
