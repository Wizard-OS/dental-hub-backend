# Feature 03 - Pacientes

## Epica Jira

**DH-PAT - Gestion de pacientes por clinica**

## Objetivo

Centralizar datos administrativos, contacto y antecedentes basicos de pacientes respetando el aislamiento por clinica.

## Usuarios/personas

- Secretaria/recepcion.
- Odontologo/especialista.
- Administrador de clinica.

## Alcance MVP

- Crear, editar, buscar y eliminar pacientes dentro de la clinica activa.
- Campos minimos: nombre, apellido, fecha de nacimiento, genero, email, telefono y direccion.
- Buscar por UUID, email, nombre o apellido.
- Permitir mismo email/telefono en clinicas distintas.
- Bloquear duplicados dentro de la misma clinica.

## Historias MVP

- Como recepcion, quiero registrar un paciente con datos minimos.
- Como recepcion, quiero buscar pacientes rapidamente.
- Como odontologo, quiero acceder a la ficha del paciente desde la clinica activa.
- Como sistema, quiero evitar duplicados por email o telefono dentro de la misma clinica.

## Criterios de aceptacion

- Todo paciente tiene `clinicId` obligatorio.
- Crear paciente sin `clinicId` en body funciona si `x-clinic-id` es valido.
- Si body trae `clinicId`, debe coincidir con `x-clinic-id`.
- Email y telefono son unicos por clinica cuando existen.
- Un usuario sin membership no puede leer pacientes de otra clinica.

## Endpoints/modelos afectados

- `POST /patients/create`
- `GET /patients`
- `GET /patients/:term`
- `PATCH /patients/:id`
- `DELETE /patients/:id`
- `Patient`

## Escenarios de prueba

- Crear paciente en clinica A.
- Crear otro paciente con mismo email en clinica B.
- Crear duplicado con mismo email en clinica A devuelve `400`.
- Buscar paciente de clinica B usando token sin membership devuelve `401`.
- Actualizar `clinicId` hacia otra clinica devuelve `400`.

## Dependencias

- Clinicas.
- Multitenancy.
- Historia clinica.
- Agenda.
- Finanzas.

## Fuera de alcance MVP

- Portal del paciente.
- Formularios de anamnesis online.
- Consentimientos digitales.
- Segmentacion avanzada.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: anamnesis online, etiquetas y consentimientos preconsulta.
- Fase 3: portal del paciente y autogestion limitada de datos.
- Futuro: scoring de riesgo, segmentacion preventiva y marketing.
