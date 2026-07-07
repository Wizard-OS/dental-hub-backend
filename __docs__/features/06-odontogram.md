# Feature 06 - Odontograma

## Epica Jira

**DH-ODO - Odontograma basico por paciente**

## Objetivo

Representar el estado dental del paciente y conectar piezas dentales con diagnosticos, tratamientos y evoluciones clinicas.

## Usuarios/personas

- Odontologo general.
- Especialista.
- Administrador clinico.

## Alcance MVP

- Visualizar odontograma adulto basico.
- Registrar estado por pieza dental.
- Asociar cambios a paciente, profesional, fecha y observacion.
- Consultar ultimo estado dental del paciente.
- Mantener aislamiento por clinica a traves del paciente.

## Historias MVP

- Como odontologo, quiero actualizar el estado de una pieza dental durante la consulta.
- Como odontologo, quiero ver el estado actual del odontograma del paciente.
- Como sistema, quiero guardar quien hizo cada cambio y cuando.
- Como equipo clinico, quiero conectar hallazgos del odontograma con tratamientos.

## Criterios de aceptacion

- Un odontograma siempre pertenece a un paciente de la clinica activa.
- La pieza dental debe usar una nomenclatura valida definida para MVP.
- El estado debe pertenecer a un catalogo MVP: sano, caries, ausente, restaurado, endodoncia, corona, implante, extraccion indicada u observacion.
- Cada cambio guarda profesional/membership y fecha.
- El MVP no requiere imagenes ni IA.

## Endpoints/modelos afectados

- Nuevo modulo sugerido: `odontogram`
- `GET /patients/:id/odontogram`
- `PATCH /patients/:id/odontogram/teeth/:toothCode`
- Modelos sugeridos: `OdontogramEntry`, `ToothStatus`
- Relacion con `Patient`, `ClinicalNote` y `Treatment`

## Escenarios de prueba

- Crear/actualizar estado de pieza para paciente de la clinica.
- Intentar actualizar odontograma de paciente de otra clinica devuelve `400` o `401`.
- Consultar odontograma devuelve estados actuales ordenados por pieza.
- Cambio registra autor y fecha.

## Dependencias

- Pacientes.
- Historia clinica.
- Clinicas y equipo.
- Tratamientos.

## Fuera de alcance MVP

- Odontograma infantil.
- Historial visual comparativo.
- Estados configurables por clinica.
- Deteccion asistida desde imagenes.

## Backlog Fase 2/Fase 3/Futuro

- Fase 2: odontograma infantil, historial visual y comparacion inicial/actual.
- Fase 3: odontogramas por especialidad y auditoria avanzada.
- Futuro: deteccion asistida y sugerencias de tratamiento.
