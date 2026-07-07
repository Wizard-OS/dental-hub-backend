# DentalHub Backend - Features para Jira

## Proposito

Esta carpeta convierte el PRD de referencia en salidas operables para Jira. Cada archivo en `features/` puede mapearse a una epica o a un conjunto de historias del backlog.

El MVP usa **clinica como tenant**. La clinica activa viaja en `x-clinic-id` y el acceso se valida contra `clinic_memberships`. Multi-sede, portal del paciente, suscripciones completas, pagos online, teleconsulta e IA quedan fuera del MVP y se documentan como roadmap.

## Convenciones para Jira

- **Epica Jira**: titulo sugerido para crear la epica.
- **Historias MVP**: items listos para convertirse en issues.
- **Criterios de aceptacion**: condiciones verificables por QA/producto.
- **Endpoints/modelos afectados**: contrato tecnico esperado.
- **Escenarios de prueba**: base para QA manual o e2e.
- **Backlog futuro**: Fase 2, Fase 3 y Futuro.

## Fases

- **MVP**: operacion diaria de una clinica dental pequena o mediana.
- **Fase 2**: automatizacion, productividad, reportes ampliados e integraciones simples.
- **Fase 3**: escalabilidad SaaS, portal paciente, pagos online, multi-sede y permisos granulares.
- **Futuro**: IA, analitica predictiva, marketplace, contabilidad y enterprise.

## Indice de Features

1. [Multitenancy y seguridad](features/01-multitenancy-security.md)
2. [Clinicas, equipo y roles](features/02-clinics-team-roles.md)
3. [Pacientes](features/03-patients.md)
4. [Agenda y citas](features/04-appointments.md)
5. [Historia clinica](features/05-clinical-records.md)
6. [Odontograma](features/06-odontogram.md)
7. [Tratamientos](features/07-treatments.md)
8. [Presupuestos, facturacion y pagos](features/08-estimates-invoices-payments.md)
9. [Archivos y documentos](features/09-files-documents.md)
10. [Recordatorios y comunicaciones](features/10-reminders-communications.md)
11. [Reportes y dashboard](features/11-reports-dashboard.md)
12. [Planes SaaS](features/12-saas-plans.md)
13. [Portal del paciente](features/13-patient-portal.md)
14. [Integraciones y futuro](features/14-integrations-future.md)

## Notas de Implementacion MVP

- El backend debe rechazar cualquier lectura o escritura tenant-owned si el usuario no tiene membership activa en la clinica del header.
- Los roles globales de usuario no reemplazan el rol por clinica. Las acciones de equipo y configuracion se autorizan con `ClinicMembershipRole`.
- Los DTOs scoped pueden aceptar `clinicId` por compatibilidad, pero `x-clinic-id` es la fuente autoritativa.
- Todo ticket nuevo debe declarar si es MVP, Fase 2, Fase 3 o Futuro.
