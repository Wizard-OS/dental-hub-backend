# Feature 09 - Archivos y Documentos

## Epica Jira

**DH-FILE - Adjuntos clinicos y documentos del paciente**

## Objetivo

Almacenar archivos asociados a pacientes, atenciones, tratamientos o documentos administrativos, respetando permisos clinicos y tenant.

## Usuarios/personas

- Odontologo/especialista.
- Secretaria/recepcion.
- Administrador de clinica.

## Alcance MVP

- Adjuntar archivos a paciente.
- Registrar tipo, nombre, URL/ruta, usuario que subio y fecha.
- Permitir asociacion opcional a cita, nota clinica o tratamiento.
- Validar que todas las entidades relacionadas pertenezcan a la clinica activa.
- Definir limites basicos de tamano y tipos permitidos.

## Historias MVP

- Como odontologo, quiero subir radiografias o imagenes del paciente.
- Como recepcion, quiero adjuntar documentos administrativos.
- Como equipo clinico, quiero ver archivos del paciente ordenados por fecha.
- Como sistema, quiero impedir archivos asociados a pacientes de otra clinica.

## Criterios de aceptacion

- Un archivo siempre pertenece a un paciente.
- El paciente pertenece a la clinica activa.
- Se registran uploader, fecha y metadata minima.
- Solo roles autorizados pueden ver archivos clinicos.
- El MVP puede usar almacenamiento local o URL administrada por backend.

## Endpoints/modelos afectados

- Nuevo modulo sugerido: `patient-files`
- `POST /patients/:id/files`
- `GET /patients/:id/files`
- `GET /patient-files/:id`
- `DELETE /patient-files/:id`
- Modelo sugerido: `PatientFile`

## Escenarios de prueba

- Subir archivo a paciente de la clinica activa.
- Listar archivos del paciente.
- Subir archivo a paciente de otra clinica devuelve `400` o `401`.
- Borrar archivo deja trazabilidad o soft delete.

## Dependencias

- Pacientes.
- Historia clinica.
- Auth.
- Almacenamiento.

## Fuera de alcance MVP

- Firma digital.
- OCR.
- Clasificacion automatica.
- Compartir documentos con paciente.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: categorias, formularios, consentimientos y exportacion.
- Fase 3: firma digital y compartir documentos seleccionados.
- Futuro: OCR, gestion documental avanzada y retencion legal configurable.
