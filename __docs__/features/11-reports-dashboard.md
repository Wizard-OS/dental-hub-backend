# Feature 11 - Reportes y Dashboard

## Epica Jira

**DH-REP - Dashboard operativo y financiero por clinica**

## Objetivo

Dar visibilidad minima de actividad, ingresos, gastos, deuda, recordatorios y tratamientos activos por clinica.

## Usuarios/personas

- Owner de clinica.
- Administrador.
- Recepcion con permisos financieros limitados.

## Alcance MVP

- Dashboard por clinica activa.
- Conteos de citas y recordatorios.
- Totales de ingresos y gastos.
- Resumen de invoices pendientes/pagadas.
- Filtros basicos por periodo donde aplique.
- No mezclar datos entre clinicas.

## Historias MVP

- Como administrador, quiero ver ingresos y gastos de mi clinica.
- Como recepcion, quiero ver citas y recordatorios pendientes.
- Como owner, quiero identificar pagos pendientes.
- Como sistema, quiero que los reportes respeten el tenant activo.

## Criterios de aceptacion

- `GET /common/dashboard` requiere `x-clinic-id`.
- Los calculos usan solo datos de la clinica activa.
- Pagos se agregan por invoices de la clinica activa.
- Recordatorios se agregan por citas de la clinica activa.
- Los totales no fallan si no hay datos.

## Endpoints/modelos afectados

- `GET /common/dashboard`
- `GET /expenses/totals`
- `Invoice`
- `Payment`
- `Expense`
- `Appointment`
- `Reminder`
- `Treatment`

## Escenarios de prueba

- Crear gasto y ver que sube el total.
- Crear pago y ver ingresos en dashboard.
- Usuario de clinica A no ve datos de clinica B.
- Dashboard vacio devuelve ceros y arrays vacios, no error.

## Dependencias

- Agenda.
- Finanzas.
- Gastos.
- Recordatorios.
- Tratamientos.

## Fuera de alcance MVP

- Exportacion Excel/PDF.
- Reportes por profesional y servicio.
- Dashboards SaaS globales.
- Analitica predictiva.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: reportes por profesional, metodo de pago, servicio y no asistencia.
- Fase 3: dashboards por sede y metricas SaaS.
- Futuro: alertas automaticas por deuda, abandono y baja ocupacion.
