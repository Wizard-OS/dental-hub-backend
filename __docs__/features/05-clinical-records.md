# Feature 05 - Historia Clinica

## Epica Jira

**DH-CHR - Historia clinica odontologica trazable**

## Objetivo

Registrar antecedentes, evoluciones clinicas y notas profesionales por paciente dentro de la clinica activa.

## Usuarios/personas

- Odontologo/especialista.
- Administrador clinico.
- Secretaria con acceso limitado, segun permisos.

## Alcance MVP

- Crear un registro clinico por paciente.
- Guardar alergias, enfermedades cronicas y antecedentes.
- Crear notas/evoluciones con autor y membership.
- Consultar linea clinica por paciente.
- Restringir todo acceso por clinica.

## Historias MVP

- Como odontologo, quiero crear la historia clinica de un paciente.
- Como odontologo, quiero agregar una nota de evolucion.
- Como equipo clinico, quiero consultar la historia de un paciente sin mezclar datos de otra clinica.
- Como sistema, quiero impedir mas de un registro clinico por paciente.

## Criterios de aceptacion

- El paciente del registro debe pertenecer a la clinica activa.
- No puede existir mas de un `clinical_record` por paciente.
- La nota clinica debe apuntar a un record de la clinica activa.
- La nota guarda `authorId` y `authorMembershipId`.
- El usuario de otra clinica no puede leer ni escribir notas.

## Endpoints/modelos afectados

- `POST /clinical-records`
- `GET /clinical-records`
- `GET /clinical-records/:id`
- `PATCH /clinical-records/:id`
- `DELETE /clinical-records/:id`
- `POST /clinical-notes`
- `GET /clinical-notes`
- `PATCH /clinical-notes/:id`
- `ClinicalRecord`
- `ClinicalNote`

## Escenarios de prueba

- Crear clinical record para paciente de la clinica.
- Crear duplicado devuelve `400`.
- Crear nota con record de otra clinica devuelve `400` o `401` segun membership.
- Listado de notas solo devuelve datos de la clinica activa.

## Dependencias

- Pacientes.
- Clinicas y equipo.
- Odontograma.
- Archivos.

## Fuera de alcance MVP

- Firma digital.
- Versionado clinico.
- Plantillas por especialidad.
- Auditoria avanzada.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: plantillas clinicas, recetas, indicaciones y consentimientos imprimibles.
- Fase 3: versionado, firma digital y auditoria avanzada.
- Futuro: resumen asistido por IA y alertas clinicas.
