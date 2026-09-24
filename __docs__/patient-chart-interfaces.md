# Contrato para expediente del paciente y tipos de cita

Todos los endpoints tienen prefijo `/api`, autenticación Bearer y cabecera `x-clinic-id`. Los nuevos endpoints clínicos mantienen los roles de ficha clínica (owner, admin, odontologist, specialist) y comprueban el acceso al paciente. Crear, editar y eliminar exige permiso de gestión clínica.

## Ficha clínica

- Datos personales/contacto: endpoints existentes `GET /patients/:id` y `PATCH /patients/:id` (`birthDate`, `gender`, `documentId`, `emergencyContact`, etc.). El frontend calcula la edad a partir de la fecha de nacimiento.
- `GET /clinical-records/patient/:patientId`: ficha del paciente, con `patient` sujeto a las restricciones de visibilidad de contacto. Devuelve 404 si todavía no tiene ficha.
- Crear con `POST /clinical-records`; editar con `PATCH /clinical-records/:id`.
- Nuevos campos opcionales: `bloodType` (A±, B±, AB±, O±), `healthInsurance` (mutualista), `currentMedication`, `habits`. Admiten `null` para vaciarse.
- Se conservan `allergies`, `chronicDiseases`, `medicalHistory`, `dentalHistory`, `observations`. Mostrar el aviso de alergias cuando `allergies` tenga contenido.
- La ficha y las notas no se pueden trasladar a otro paciente/registro, para evitar que los adjuntos queden asociados a un paciente distinto.

```json
{
  "patientId": "<uuid>",
  "allergies": "Penicilina",
  "bloodType": "A+",
  "healthInsurance": "Asociación Española",
  "currentMedication": "No refiere",
  "habits": "Bruxismo nocturno"
}
```

## Exámenes complementarios

- `POST /patients/:patientId/exams`: crear examen.
- `GET /patients/:patientId/exams`: listar con `category`, `clinicalNoteId`, `search`, `from`, `to`, `limit` (1–100, defecto 30), `offset` (defecto 0).
- `GET`, `PATCH`, `DELETE /patients/:patientId/exams/:id`: detalle, editar o eliminar.
- Respuesta de lista: `{ "items": [...], "total": 0, "limit": 30, "offset": 0 }`, por `performedAt` descendente con desempate por ID.
- Categorías: `radiography` (placas), `cephalometry`, `photography` (grupos de fotos), `other`. Omitir `category` para “Todos”.
- Cada examen incluye `files` y `measurements`. Los archivos eliminados/no disponibles se excluyen. El frontend puede mostrar las miniaturas y la cantidad de fotos a partir de `files`.
- Cámara/archivos: subir primero con el endpoint existente `POST /patients/:patientId/files` (`multipart/form-data`, campo `file`), luego enviar los UUID en `fileIds`. Las mediciones no necesitan un archivo.
- `fileIds` en PATCH sustituye el conjunto de archivos; `[]` lo vacía; omitirlo conserva las asociaciones. Solo admite archivos disponibles del mismo paciente. Eliminar un examen no elimina sus archivos originales.

```json
{
  "title": "Mediciones cefalométricas",
  "category": "cephalometry",
  "performedAt": "2026-09-02T12:30:00Z",
  "clinicalNoteId": "<uuid de una nota del mismo paciente>",
  "fileIds": ["<uuid del archivo subido>"],
  "measurements": [
    { "name": "SNA", "value": 82, "unit": "degrees", "reference": "82 ± 2" }
  ]
}
```

## Evoluciones

Se mantienen `POST /clinical-notes`, `PATCH /clinical-notes/:id` y `DELETE /clinical-notes/:id`.

- Nuevos campos: `title` (ej. “Control de ortodoncia”) y `occurredAt` (fecha efectiva de la consulta, por defecto ahora). `createdAt` sigue siendo la fecha de registro.
- `content` representa la evolución; se conservan `procedure`, `indications`, `reason`, `diagnosis`, `observations` y `toothCodes`.
- `GET /clinical-notes/patient/:patientId`: historial paginado con `search`, `authorMembershipId`, `clinicalNoteId`, `from`, `to`, `limit`, `offset`.
- Misma envoltura paginada que exámenes, ordenada por `occurredAt` descendente y luego ID.
- Incluye autor (`id`, `firstName`, `lastName`), `files` directamente asociados y `exams` con sus archivos/mediciones. Para el contador de adjuntos, unir y deduplicar los archivos por ID.
- Adjuntar a una evolución: enviar `clinicalNoteId` al subir el archivo; para vincular un examen completo, enviar `clinicalNoteId` al crear/editar el examen.
- “Antes y después” se puede construir en el frontend seleccionando dos imágenes de estos adjuntos o del historial de exámenes. No se genera una imagen comparativa ni se persiste una selección de pares.

## Tipos de cita

- Endpoints existentes: `POST /appointments/types`, `PATCH /appointments/types/:id`, `DELETE /appointments/types/:id` (desactivación).
- `GET /appointments/types/all?search=ortodoncia`: búsqueda por nombre; ahora omite los inactivos. Usar `includeInactive=true` para incluirlos.
- `GET /appointments/types/:id`: detalle para editar.
- `GET /appointments/types/recent-colors`: hasta 8 colores distintos, normalizados a mayúsculas, ordenados por la modificación más reciente de los tipos que los usan. Son colores actualmente guardados en tipos; no un historial de selecciones descartadas en el selector.
- `defaultPrice` es opcional y admite `null` (“Sin precio”); `"0"` es precio cero. PATCH con `null` borra el precio; omitirlo lo conserva. Enviar decimal sin separadores de miles (`"1200.00"`, no `"1.200"`).
- `currency`: código de tres letras mayúsculas, por defecto `UYU`.
- `color`: HEX de seis dígitos, como `#8B5CF6`; el selector y la vista previa de agenda se renderizan en el frontend. La agenda existente incluye la relación `appointmentType`.
- `durationMin`: entero mínimo 5; admite los botones de 15/30/45/60 y duración personalizada.

```json
{
  "name": "Ortodoncia",
  "durationMin": 45,
  "defaultPrice": "1200.00",
  "currency": "UYU",
  "color": "#8B5CF6"
}
```

## Configuración de agenda, recordatorios y reservas

- `GET /clinics/:id/appointment-settings`: devuelve la configuración normalizada para las pantallas de agenda. Si la clínica solo tiene el formato legacy de `workingHoursJson` (`monday`, `tuesday`, etc.), el backend lo convierte a `availability.weekly`.
- `PATCH /clinics/:id/appointment-settings`: guarda un PATCH parcial. Requiere permiso `canManageSchedule`; owner/admin lo tienen por defecto. Las secciones omitidas se conservan.
- La configuración se persiste en `clinics.workingHoursJson.appointmentSettings` para mantener compatibilidad con el campo existente.
- `availability.scope`: `clinic` o `professional`.
- `GET /clinics/:id/professionals/:membershipId/appointment-settings`: devuelve `{ settings, overrides, inheritedFromClinic }`, combinando configuración de clínica con overrides del profesional.
- `PATCH /clinics/:id/professionals/:membershipId/appointment-settings`: guarda overrides parciales en `clinic_memberships.appointmentSettingsJson`. Owner/admin/usuarios con `canManageSchedule` pueden editar cualquier profesional; un profesional puede editar su propia disponibilidad.
- `availability.weekly`: siete días con `dayOfWeek` 1-7, `isOpen`, `startTime` y `endTime`. Los días abiertos deben tener inicio y fin, y el inicio debe ser anterior al fin.
- `availability.breaks`: pausas recurrentes con nombre, días y rango horario.
- `availability.specialDates`: feriados, vacaciones o excepciones por fecha (`YYYY-MM-DD`). Si `isClosed=false`, exige horario.
- `GET /appointments/agenda?from=ISO&to=ISO&professionalMembershipId=uuid`: devuelve `{ appointments, availability }` para listar citas junto con la disponibilidad normalizada del profesional. `availability` incluye `timezone`, `weekly`, `breaks`, `specialDates` y `scheduling`.
- `scheduling.defaultDurationMin`, `slotIntervalMin`, `bufferBetweenAppointmentsMin`: duración predeterminada, intervalos de inicio y tiempo entre citas.
- `reminders`: habilitación, canales (`whatsapp`, `email`, `sms`, `push_notification`), avisos en minutos antes de la cita y plantilla con variables como `{nombre}`, `{tipo}`, `{fecha}`, `{hora}`.
- `confirmation`: solicitud de confirmación, canal, momento de envío, plazo de respuesta y acción si no responde (`keep_pending`, `mark_unanswered`, `cancel`). El plazo de respuesta debe quedar más cerca de la cita que el momento de envío.
- `bookingRules`: reservas de pacientes, anticipación mínima, máximo de días hacia adelante, máximo de citas activas y aprobación `automatic` o `manual`.
- `changeRules`: reglas de cancelación/reprogramación, cambios máximos por cita, acción fuera de plazo (`contact_clinic`) y notificación al profesional.
- `POST /appointments` y `PATCH /appointments/:id` validan contra la disponibilidad del profesional: rechazan citas fuera del horario local de la clínica, sobre pausas, en fechas especiales cerradas o fuera del rango de una fecha especial abierta. Si no se envía `professionalMembershipId`, intentan resolverlo desde `dentistId`; si no es posible, devuelven `400`.
- `Appointment` ahora incluye `confirmationStatus` (`pending`, `confirmed`, `no_response`, `declined`), `confirmationRequestedAt`, `confirmedAt`, `lastRescheduledAt` y `rescheduleCount` para reflejar los estados de confirmación y reprogramación en la agenda.

```json
{
  "availability": {
    "scope": "clinic",
    "weekly": [
      {
        "dayOfWeek": 1,
        "isOpen": true,
        "startTime": "09:00",
        "endTime": "18:00"
      },
      { "dayOfWeek": 6, "isOpen": false }
    ],
    "breaks": [
      {
        "name": "Almuerzo",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "13:00",
        "endTime": "14:00"
      }
    ],
    "specialDates": [
      { "date": "2026-12-25", "isClosed": true, "reason": "Feriado" }
    ]
  },
  "scheduling": {
    "defaultDurationMin": 30,
    "slotIntervalMin": 15,
    "bufferBetweenAppointmentsMin": 10
  },
  "reminders": {
    "enabled": true,
    "channels": ["whatsapp", "email"],
    "noticesBeforeMinutes": [1440, 120],
    "messageTemplate": "Hola, {nombre}. Te recordamos tu cita de {tipo} el {fecha} a las {hora}."
  },
  "confirmation": {
    "enabled": true,
    "requestBeforeMinutes": 1440,
    "responseDeadlineBeforeMinutes": 120,
    "channel": "whatsapp",
    "noResponseAction": "keep_pending"
  },
  "bookingRules": {
    "patientBookingEnabled": true,
    "minNoticeMinutes": 120,
    "maxAdvanceDays": 60,
    "maxActiveAppointmentsPerPatient": 3,
    "approvalMode": "automatic"
  },
  "changeRules": {
    "cancellation": { "enabled": true, "minNoticeMinutes": 1440 },
    "reschedule": {
      "enabled": true,
      "minNoticeMinutes": 720,
      "maxChangesPerAppointment": 2
    },
    "outOfWindowAction": "contact_clinic",
    "notifyProfessional": true
  }
}
```

## Base de datos y verificación

Aplicar `src/migrations/202609090001_patient_chart_and_appointment_types.sql` antes de desplegar con `DB_SYNCHRONIZE=false`. La migración conserva la fecha histórica de las notas usando `createdAt` y los precios existentes; agrega `currency` con valor inicial `UYU` (ajustar los tipos de clínicas que usen otra moneda), crea la tabla de exámenes y agrega la metadata de confirmación/reprogramación en citas. Es aditiva y admite ejecutarse de nuevo.

Aplicar también `src/migrations/202609230002_professional_appointment_settings.sql` para habilitar overrides de agenda por profesional.

Se verificó la migración dos veces sobre un esquema temporal de PostgreSQL 14 dentro de una transacción terminada con ROLLBACK, incluyendo fechas históricas, precio nulo y eliminación de asociaciones sin borrar archivos. No se aplicó a los datos de la aplicación.
