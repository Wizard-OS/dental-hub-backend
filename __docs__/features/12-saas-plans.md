# Feature 12 - Planes SaaS

## Epica Jira

**DH-SaaS - Preparacion de planes y limites comerciales**

## Objetivo

Preparar DentalHub para operar como SaaS por clinica, sin implementar facturacion recurrente completa en el MVP.

## Usuarios/personas

- Owner de clinica.
- Administrador SaaS en fases posteriores.
- Equipo comercial/soporte.

## Alcance MVP

- Definir planes de referencia en documentacion.
- Preparar modelo para asociar clinica a plan en fases posteriores.
- Identificar funciones premium.
- No bloquear funcionalidades MVP por plan todavia.

## Historias MVP

- Como negocio, quiero documentar planes Starter, Pro, Clinic y Enterprise.
- Como producto, quiero etiquetar features por fase/plan.
- Como equipo tecnico, quiero evitar decisiones de modelo que bloqueen suscripciones futuras.

## Criterios de aceptacion

- Documentacion indica que `Clinic` es unidad comercial base.
- Las funciones premium estan identificadas.
- El MVP no requiere pasarela de pagos.
- Las historias futuras separan limites visibles, suscripciones y super admin.

## Endpoints/modelos afectados

- Sin endpoints obligatorios MVP.
- Modelo futuro sugerido: `SaasPlan`, `ClinicSubscription`, `PlanLimit`.
- Relacion futura con `Clinic`.

## Escenarios de prueba

- Validar que no existan dependencias obligatorias de plan para operar MVP.
- Revisar que tickets futuros tengan fase y plan objetivo.

## Dependencias

- Clinicas.
- Usuarios/memberships.
- Reportes SaaS en Fase 3.
- Pagos online en Fase 3.

## Fuera de alcance MVP

- Facturacion recurrente.
- Trial automatico.
- Upgrade/downgrade.
- Cancelacion/reactivacion.
- Cobro online de suscripcion.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: mostrar limites por plan y alertas de limite cercano.
- Fase 3: suscripciones completas, prueba gratuita, super admin SaaS y pagos recurrentes.
- Futuro: planes enterprise, marketplace y facturacion corporativa multi-sede.
