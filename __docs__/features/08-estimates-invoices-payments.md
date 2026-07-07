# Feature 08 - Presupuestos, Facturacion y Pagos

## Epica Jira

**DH-FIN - Presupuestos simples, facturacion y cobros**

## Objetivo

Formalizar costos de tratamientos, registrar cobros manuales y consultar saldos e ingresos por clinica.

## Usuarios/personas

- Secretaria/recepcion.
- Administrador de clinica.
- Odontologo que propone tratamiento.

## Alcance MVP

- Usar `invoices` como documento comercial base para presupuestos/facturacion simple.
- Crear items con cantidad, precio unitario y total.
- Asociar invoice a paciente de la clinica activa.
- Registrar pagos manuales.
- Recalcular estado: pendiente, parcialmente pagado, pagado, vencido o cancelado.
- Reportar ingresos por periodo desde dashboard.

## Historias MVP

- Como recepcion, quiero crear un presupuesto/factura simple para un paciente.
- Como recepcion, quiero registrar un pago manual.
- Como administrador, quiero ver saldos e ingresos.
- Como sistema, quiero impedir pagos contra invoices de otra clinica.

## Criterios de aceptacion

- `Invoice.clinicId` es obligatorio.
- El paciente de la invoice pertenece a la clinica activa.
- El numero de invoice es unico por clinica.
- Un pago solo puede asociarse a invoice de la clinica activa.
- Los totales de items se recalculan al agregar o quitar items.
- Un pago parcial cambia estado a `partially_paid`.

## Endpoints/modelos afectados

- `POST /invoices`
- `GET /invoices`
- `GET /invoices/:id`
- `PATCH /invoices/:id`
- `DELETE /invoices/:id`
- `POST /invoices/:id/items`
- `DELETE /invoices/:invoiceId/items/:itemId`
- `POST /payments`
- `GET /payments`
- `Invoice`
- `InvoiceItem`
- `Payment`

## Escenarios de prueba

- Crear invoice sin `clinicId` body usando header.
- Crear invoice con paciente de otra clinica devuelve `400`.
- Registrar pago parcial y verificar estado.
- Intentar pago sobre invoice de otra clinica devuelve `404` o `400`.
- Listado de invoices solo devuelve las de la clinica activa.

## Dependencias

- Pacientes.
- Tratamientos.
- Dashboard/reportes.

## Fuera de alcance MVP

- Pasarela de pago online.
- Recibos avanzados.
- Facturacion fiscal automatica.
- Suscripciones SaaS.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: recibos exportables, cierre de caja y reportes por metodo.
- Fase 3: portal del paciente, aprobacion digital y pagos online.
- Futuro: conciliacion bancaria, contabilidad e indicadores de rentabilidad.
