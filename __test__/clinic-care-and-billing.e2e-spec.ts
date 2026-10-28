import fs from 'fs';

import { HttpStatus, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PersonalDriveStorage } from '../src/storage/infrastructure/personal-drive-storage';
import type { StorageUploadInput } from '../src/storage/interfaces/storage-provider.interface';
import { LocalStorageProvider } from '../src/storage/providers/local-storage.provider';
import {
  readJsonArray,
  readJsonString,
  readJsonValue,
} from './support/json-response';
import {
  configureTestApplication,
  seedTestDatabase,
} from './support/test-application';

describe('Clinic care and billing (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let adminUserId: string;
  let doctorToken: string;
  let doctorUserId: string;
  let assistantToken: string;
  let assistantUserId: string;
  let clinicId: string;
  let membershipId: string;
  let assistantMembershipId: string;
  let patientId: string;
  let patientDocumentId: string;
  let appointmentTypeId: string;
  let appointmentId: string;
  let clinicalRecordId: string;
  let clinicalNoteId: string;
  let treatmentId: string;
  let invoiceId: string;
  let paymentId: string;
  let patientFileId: string;
  let patientFilePath: string;
  let appointmentStartIso: string;
  let appointmentEndIso: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PersonalDriveStorage)
      .useValue({
        upload: (input: StorageUploadInput) =>
          new LocalStorageProvider().upload(input),
      })
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureTestApplication(app);
    await app.init();

    await seedTestDatabase(app);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test1@google.com',
        password: 'Abc123',
      })
      .expect(HttpStatus.CREATED);

    adminToken = readJsonString(loginResponse.body, 'token');
    adminUserId = readJsonString(loginResponse.body, 'id');

    const doctorLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test2@google.com',
        password: 'Abc123',
      })
      .expect(HttpStatus.CREATED);

    doctorToken = readJsonString(doctorLoginResponse.body, 'token');
    doctorUserId = readJsonString(doctorLoginResponse.body, 'id');

    const assistantResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `assistant_${Date.now()}@example.com`,
        password: 'Long dental passphrase 123',
        firstName: 'Asistente',
        lastName: 'Dental',
      })
      .expect(HttpStatus.CREATED);

    assistantToken = readJsonString(assistantResponse.body, 'token');
    assistantUserId = readJsonString(assistantResponse.body, 'id');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates clinic with owner membership', async () => {
    const clinicResponse = await request(app.getHttpServer())
      .post('/clinics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dental Hub Clinic',
        phone: '+59824000000',
        email: `clinic_${Date.now()}@example.com`,
        address: 'Av. Principal 123',
        timezone: 'America/Montevideo',
        countryCode: 'UY',
        workingHoursJson: {
          monday: [{ from: '09:00', to: '18:00' }],
        },
      })
      .expect(HttpStatus.CREATED);

    clinicId = readJsonString(clinicResponse.body, 'id');
    expect(clinicResponse.body).toEqual(
      expect.objectContaining({
        countryCode: 'UY',
        countryName: 'Uruguay',
        currency: 'UYU',
        callingCodes: ['598'],
        defaultCallingCode: '598',
      }),
    );

    const membershipsResponse = await request(app.getHttpServer())
      .get('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    const memberships = readJsonArray(membershipsResponse.body);
    const ownerMembership = memberships.find(
      (membership) =>
        readJsonString(membership, 'userId') === adminUserId &&
        readJsonString(membership, 'role') === 'owner',
    );

    expect(ownerMembership).toBeDefined();

    if (!ownerMembership) {
      throw new Error('Expected owner membership to be present');
    }

    membershipId = readJsonString(ownerMembership, 'id');

    await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: doctorUserId,
        role: 'odontologist',
      })
      .expect(HttpStatus.CREATED);
    await request(app.getHttpServer())
      .patch('/membership/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        planCode: 'premium',
        reason: 'Allow assistant membership for patient access regressions',
      })
      .expect(HttpStatus.OK);

    const assistantMembershipResponse = await request(app.getHttpServer())
      .post('/clinic-memberships')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        userId: assistantUserId,
        role: 'assistant',
      })
      .expect(HttpStatus.CREATED);

    assistantMembershipId = readJsonString(
      assistantMembershipResponse.body,
      'id',
    );
  });

  it('creates patient, appointment type and appointment in clinic scope', async () => {
    patientDocumentId = `UY-${Date.now()}`;

    const patientResponse = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `patient_${Date.now()}@example.com`,
        firstName: 'Ana',
        lastName: 'Perez',
        documentId: patientDocumentId,
        birthDate: '1993-08-20',
        gender: 'Female',
        profession: 'Arquitecta',
        streetAddress: 'Av. Principal',
        addressNumber: '1234',
        neighborhood: 'Centro',
        city: 'Montevideo',
        postalCode: '11000',
        phone: `+5989${Date.now().toString().slice(-8)}`,
        emergencyContact: 'Laura Perez +59891111111',
        medicalHistory: 'Sin alergias conocidas',
        dentalHistory: 'Restauración antigua',
        observations: 'Prefiere agenda matutina',
      })
      .expect(HttpStatus.CREATED);

    patientId = readJsonString(patientResponse.body, 'id');
    expect(patientResponse.body).toEqual(
      expect.objectContaining({
        profession: 'Arquitecta',
        streetAddress: 'Av. Principal',
        addressNumber: '1234',
        neighborhood: 'Centro',
        city: 'Montevideo',
        postalCode: '11000',
        profilePhotoFileId: null,
        profilePhotoUrl: null,
      }),
    );

    const patientByDocument = await request(app.getHttpServer())
      .get(`/patients/${patientDocumentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(readJsonString(patientByDocument.body, 'id')).toBe(patientId);

    const typeResponse = await request(app.getHttpServer())
      .post('/appointments/types')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        name: 'Consulta General',
        durationMin: 30,
        defaultPrice: '60.00',
      })
      .expect(HttpStatus.CREATED);

    appointmentTypeId = readJsonString(typeResponse.body, 'id');

    const startAt = new Date('2026-09-28T12:30:00.000Z');
    const endAt = new Date('2026-09-28T13:00:00.000Z');

    appointmentStartIso = startAt.toISOString();
    appointmentEndIso = endAt.toISOString();

    const appointmentResponse = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        patientId,
        appointmentTypeId,
        professionalMembershipId: membershipId,
        description: 'Control inicial',
        startTime: appointmentStartIso,
        endTime: appointmentEndIso,
      })
      .expect(HttpStatus.CREATED);

    appointmentId = readJsonString(appointmentResponse.body, 'id');
  });

  it('returns professional agenda appointments with availability', async () => {
    const agendaResponse = await request(app.getHttpServer())
      .get('/appointments/agenda')
      .query({
        from: '2026-09-28T00:00:00.000Z',
        to: '2026-09-29T00:00:00.000Z',
        professionalMembershipId: membershipId,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(readJsonValue(agendaResponse.body, 'appointments')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: appointmentId,
          startTime: appointmentStartIso,
          endTime: appointmentEndIso,
        }),
      ]),
    );
    expect(readJsonValue(agendaResponse.body, 'availability')).toEqual(
      expect.objectContaining<Record<string, unknown>>({
        timezone: 'America/Montevideo',
        weekly: expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: 1,
            isOpen: true,
            startTime: '09:00',
            endTime: '18:00',
          }),
        ]),
        scheduling: expect.objectContaining({
          defaultDurationMin: 30,
          slotIntervalMin: 15,
          bufferBetweenAppointmentsMin: 10,
        }),
      }),
    );
  });

  it('updates patient profile capture fields partially', async () => {
    const updateResponse = await request(app.getHttpServer())
      .patch(`/patients/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        profession: 'Diseñadora',
        addressNumber: '5678',
        postalCode: '11200',
      })
      .expect(HttpStatus.OK);

    expect(updateResponse.body).toEqual(
      expect.objectContaining({
        profession: 'Diseñadora',
        streetAddress: 'Av. Principal',
        addressNumber: '5678',
        neighborhood: 'Centro',
        city: 'Montevideo',
        postalCode: '11200',
      }),
    );
  });

  it('allows odontologists to create and list patients without contact data', async () => {
    const doctorCreatedPatient = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `doctor_patient_${Date.now()}@example.com`,
        firstName: 'Paciente',
        lastName: 'Doctor',
        documentId: `UY-DOCTOR-${Date.now()}`,
        birthDate: '1989-04-10',
        gender: 'Other',
        phone: `+5986${Date.now().toString().slice(-8)}`,
      })
      .expect(HttpStatus.CREATED);

    const hiddenPatientResponse = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `hidden_patient_${Date.now()}@example.com`,
        firstName: 'Paciente',
        lastName: 'Oculto',
        documentId: `UY-HIDDEN-${Date.now()}`,
        birthDate: '1991-02-03',
        gender: 'Other',
        phone: `+5987${Date.now().toString().slice(-8)}`,
        address: 'Dirección reservada',
        streetAddress: 'Calle Reservada',
        addressNumber: '999',
        neighborhood: 'Barrio Reservado',
        city: 'Ciudad Reservada',
        postalCode: '99999',
        emergencyContact: 'Contacto reservado',
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${assistantToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `assistant_patient_${Date.now()}@example.com`,
        firstName: 'Paciente',
        lastName: 'Asistente',
        documentId: `UY-ASSISTANT-${Date.now()}`,
        birthDate: '1992-07-15',
        gender: 'Other',
      })
      .expect(HttpStatus.FORBIDDEN);

    const doctorPatients = await request(app.getHttpServer())
      .get('/patients')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(doctorPatients.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: patientId,
          phone: null,
          email: null,
          address: null,
          streetAddress: null,
          addressNumber: null,
          neighborhood: null,
          city: null,
          postalCode: null,
          emergencyContact: null,
        }),
        expect.objectContaining({
          id: readJsonString(doctorCreatedPatient.body, 'id'),
          phone: null,
          email: null,
        }),
        expect.objectContaining({
          id: readJsonString(hiddenPatientResponse.body, 'id'),
          phone: null,
          email: null,
          address: null,
          streetAddress: null,
          addressNumber: null,
          neighborhood: null,
          city: null,
          postalCode: null,
          emergencyContact: null,
        }),
      ]),
    );

    const hiddenPatientForDoctor = await request(app.getHttpServer())
      .get(`/patients/${readJsonString(hiddenPatientResponse.body, 'id')}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(hiddenPatientForDoctor.body).toEqual(
      expect.objectContaining({
        id: readJsonString(hiddenPatientResponse.body, 'id'),
        phone: null,
        email: null,
        address: null,
        streetAddress: null,
        addressNumber: null,
        neighborhood: null,
        city: null,
        postalCode: null,
        emergencyContact: null,
      }),
    );

    await request(app.getHttpServer())
      .get('/common/reports/income')
      .set('Authorization', `Bearer ${doctorToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('grants and removes temporary patient access through appointment assignment', async () => {
    const temporaryPatient = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `temporary_patient_${Date.now()}@example.com`,
        firstName: 'Temporal',
        lastName: 'Agenda',
        documentId: `UY-TEMP-${Date.now()}`,
        birthDate: '1995-05-05',
        gender: 'Other',
      })
      .expect(HttpStatus.CREATED);

    const startAt = new Date('2026-09-28T13:30:00.000Z');
    const endAt = new Date('2026-09-28T14:00:00.000Z');

    const temporaryAppointment = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        patientId: readJsonString(temporaryPatient.body, 'id'),
        appointmentTypeId,
        professionalMembershipId: assistantMembershipId,
        description: 'Acceso temporal',
        startTime: startAt.toISOString(),
        endTime: endAt.toISOString(),
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .get(`/patients/${readJsonString(temporaryPatient.body, 'id')}`)
      .set('Authorization', `Bearer ${assistantToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .patch(`/appointments/${readJsonString(temporaryAppointment.body, 'id')}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({ status: 3 })
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .get(`/patients/${readJsonString(temporaryPatient.body, 'id')}`)
      .set('Authorization', `Bearer ${assistantToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('documents clinical evolution, odontogram and treatment plan', async () => {
    const clinicalRecord = await request(app.getHttpServer())
      .post('/clinical-records')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        patientId,
        allergies: 'None',
        chronicDiseases: 'None',
        medicalHistory: 'Paciente sin medicación actual',
        dentalHistory: 'Restauración en pieza 36',
        observations: 'Control inicial completo',
      })
      .expect(HttpStatus.CREATED);

    clinicalRecordId = readJsonString(clinicalRecord.body, 'id');

    const clinicalNote = await request(app.getHttpServer())
      .post('/clinical-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicalRecordId,
        content: 'Se realiza evaluación inicial y se indica restauración.',
        reason: 'Dolor leve al masticar',
        diagnosis: 'Caries oclusal en pieza 36',
        procedure: 'Evaluación clínica',
        indications: 'Control y presupuesto de restauración',
        observations: 'Paciente tolera bien la consulta',
        toothCodes: ['36'],
      })
      .expect(HttpStatus.CREATED);

    clinicalNoteId = readJsonString(clinicalNote.body, 'id');

    const treatment = await request(app.getHttpServer())
      .post('/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        name: 'Restauración pieza 36',
        patientId,
        doctorId: adminUserId,
        professionalMembershipId: membershipId,
        toothCode: '36',
        description: 'Restauración de resina',
        basePrice: '100.00',
        status: 'accepted',
      })
      .expect(HttpStatus.CREATED);

    treatmentId = readJsonString(treatment.body, 'id');

    const odontogramEntry = await request(app.getHttpServer())
      .patch(`/patients/${patientId}/odontogram/teeth/36`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        status: 'caries',
        observation: 'Lesión oclusal',
        clinicalNoteId,
        treatmentId,
      })
      .expect(HttpStatus.OK);

    expect(readJsonValue(odontogramEntry.body, 'entries')).toHaveLength(1);
    expect(readJsonValue(odontogramEntry.body, 'entries', 0)).toEqual(
      expect.objectContaining({
        status: 'caries',
        surface: 'full',
        professionalMembershipId: membershipId,
      }),
    );

    const surfaceUpdate = await request(app.getHttpServer())
      .patch(`/patients/${patientId}/odontogram/teeth/36`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        status: 'restored',
        surfaces: ['vestibular', 'occlusal'],
        treatmentType: 'Restauración',
        description: 'Resina compuesta en superficies seleccionadas',
        observation: 'Se registra acción multi-superficie',
        clinicalNoteId,
        treatmentId,
      })
      .expect(HttpStatus.OK);

    const updatedEntries = readJsonArray(surfaceUpdate.body, 'entries');

    expect(updatedEntries).toHaveLength(2);
    expect(
      new Set(
        updatedEntries.map((entry) => readJsonString(entry, 'actionGroupId')),
      ).size,
    ).toBe(1);
    expect(updatedEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ surface: 'vestibular', status: 'restored' }),
        expect.objectContaining({ surface: 'occlusal', status: 'restored' }),
      ]),
    );

    const odontogram = await request(app.getHttpServer())
      .get(`/patients/${patientId}/odontogram`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(readJsonValue(odontogram.body, 'dentition', 'toothCodes')).toContain(
      '36',
    );
    expect(readJsonValue(odontogram.body, 'legend')).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'caries' })]),
    );
    expect(readJsonValue(odontogram.body, 'entries')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toothCode: '36',
          status: 'caries',
          surface: 'full',
        }),
        expect.objectContaining({
          toothCode: '36',
          status: 'restored',
          surface: 'occlusal',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .patch(`/patients/${patientId}/odontogram/teeth/49`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({ status: 'caries' })
      .expect(HttpStatus.BAD_REQUEST);

    await request(app.getHttpServer())
      .patch(`/patients/${patientId}/odontogram/teeth/36`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({ status: 'caries', surfaces: ['full', 'occlusal'] })
      .expect(HttpStatus.BAD_REQUEST);

    await request(app.getHttpServer())
      .patch(`/patients/${patientId}/odontogram/teeth/36`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        status: 'caries',
        clinicalNoteId: '00000000-0000-4000-8000-000000000000',
      })
      .expect(HttpStatus.BAD_REQUEST);

    const removableEntryId = readJsonString(
      surfaceUpdate.body,
      'entries',
      0,
      'id',
    );

    await request(app.getHttpServer())
      .delete(`/patients/${patientId}/odontogram/entries/${removableEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    const pdfResponse = await request(app.getHttpServer())
      .post(`/patients/${patientId}/odontogram/pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicalNoteId,
        treatmentId,
        description: 'Odontograma inicial',
      })
      .expect(HttpStatus.CREATED);

    expect(readJsonValue(pdfResponse.body, 'patientId')).toBe(patientId);
    expect(readJsonValue(pdfResponse.body, 'type')).toBe('pdf');
    expect(readJsonValue(pdfResponse.body, 'mimeType')).toBe('application/pdf');
    expect(fs.existsSync(readJsonString(pdfResponse.body, 'path'))).toBe(true);

    await request(app.getHttpServer())
      .delete(`/patient-files/${readJsonString(pdfResponse.body, 'id')}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);
  });

  it('handles partial payment and invoice status updates', async () => {
    const invoiceResponse = await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        patientId,
        number: `INV-${Date.now()}`,
        treatmentId,
        status: 'accepted',
        subtotal: '100.00',
        discount: '0.00',
        tax: '0.00',
        totalAmount: '100.00',
        observations: 'Presupuesto simple MVP',
        items: [
          {
            type: 'custom',
            refId: treatmentId,
            description: 'Restauración pieza 36',
            qty: 1,
            unitPrice: '100.00',
          },
        ],
      })
      .expect(HttpStatus.CREATED);

    invoiceId = readJsonString(invoiceResponse.body, 'id');

    const paymentResponse = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        invoiceId,
        amount: '40.00',
        method: 'cash',
        paidAt: new Date().toISOString(),
        receivedByMembershipId: membershipId,
      })
      .expect(HttpStatus.CREATED);

    paymentId = readJsonString(paymentResponse.body, 'id');

    const invoiceAfterPayment = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(readJsonValue(invoiceAfterPayment.body, 'status')).toBe(
      'partially_paid',
    );
  });

  it('rejects mismatched commercial document relations', async () => {
    const otherPatient = await request(app.getHttpServer())
      .post('/patients/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        email: `other_patient_${Date.now()}@example.com`,
        firstName: 'Bruno',
        lastName: 'Silva',
        documentId: `UY-OTHER-${Date.now()}`,
        birthDate: '1984-04-12',
        gender: 'Male',
        phone: `+5988${Date.now().toString().slice(-8)}`,
      })
      .expect(HttpStatus.CREATED);

    const otherTreatment = await request(app.getHttpServer())
      .post('/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        name: 'Limpieza otro paciente',
        patientId: readJsonString(otherPatient.body, 'id'),
        doctorId: adminUserId,
        professionalMembershipId: membershipId,
        description: 'Tratamiento de control',
        basePrice: '80.00',
        status: 'accepted',
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        clinicId,
        patientId,
        number: `INV-BAD-${Date.now()}`,
        treatmentId: readJsonString(otherTreatment.body, 'id'),
        subtotal: '80.00',
        discount: '0.00',
        tax: '0.00',
        totalAmount: '80.00',
      })
      .expect(HttpStatus.BAD_REQUEST);

    await request(app.getHttpServer())
      .post('/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        name: 'Tratamiento con factura ajena',
        patientId: readJsonString(otherPatient.body, 'id'),
        doctorId: adminUserId,
        professionalMembershipId: membershipId,
        description: 'Debe fallar por invoiceId',
        basePrice: '90.00',
        status: 'accepted',
        invoiceId,
      })
      .expect(HttpStatus.BAD_REQUEST);

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        invoiceId,
        patientId: readJsonString(otherPatient.body, 'id'),
        amount: '1.00',
        method: 'cash',
        paidAt: new Date().toISOString(),
      })
      .expect(HttpStatus.BAD_REQUEST);

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        invoiceId,
        treatmentId: readJsonString(otherTreatment.body, 'id'),
        amount: '1.00',
        method: 'cash',
        paidAt: new Date().toISOString(),
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('voids payments without deleting and registers another manual payment', async () => {
    const voidedPayment = await request(app.getHttpServer())
      .patch(`/payments/${paymentId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        reason: 'Pago cargado por error',
      })
      .expect(HttpStatus.OK);

    expect(readJsonValue(voidedPayment.body, 'voidedAt')).toBeDefined();
    expect(readJsonValue(voidedPayment.body, 'voidReason')).toBe(
      'Pago cargado por error',
    );

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .send({
        invoiceId,
        amount: '25.00',
        method: 'transfer',
        paidAt: new Date().toISOString(),
        receivedByMembershipId: membershipId,
      })
      .expect(HttpStatus.CREATED);

    const invoiceAfterPayment = await request(app.getHttpServer())
      .get(`/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(readJsonValue(invoiceAfterPayment.body, 'status')).toBe(
      'partially_paid',
    );
  });

  it('uploads and lists patient files', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post(`/patients/${patientId}/files`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .field('type', 'pdf')
      .field('description', 'Radiografía inicial')
      .field('appointmentId', appointmentId)
      .field('clinicalNoteId', clinicalNoteId)
      .field('treatmentId', treatmentId)
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 'radiografia.pdf',
        contentType: 'application/pdf',
      })
      .expect(HttpStatus.CREATED);

    patientFileId = readJsonString(uploadResponse.body, 'id');
    patientFilePath = readJsonString(uploadResponse.body, 'path');
    expect(readJsonValue(uploadResponse.body, 'patientId')).toBe(patientId);
    expect(readJsonString(uploadResponse.body, 'url')).toContain(
      '/api/patient-files/',
    );
    expect(fs.existsSync(patientFilePath)).toBe(true);

    const filesResponse = await request(app.getHttpServer())
      .get(`/patients/${patientId}/files`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(filesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: patientFileId,
          type: 'pdf',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .delete(`/patient-files/${patientFileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(fs.existsSync(patientFilePath)).toBe(false);

    await request(app.getHttpServer())
      .get(`/patient-files/${patientFileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('uploads profile photo and stores it as the patient primary photo', async () => {
    const profilePhotoResponse = await request(app.getHttpServer())
      .post(`/patients/${patientId}/profile-photo`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), {
        filename: 'profile.jpg',
        contentType: 'image/jpeg',
      })
      .expect(HttpStatus.CREATED);

    expect(profilePhotoResponse.body).toEqual(
      expect.objectContaining({
        patientId,
        type: 'profile_photo',
        mimeType: 'image/jpeg',
      }),
    );
    expect(readJsonString(profilePhotoResponse.body, 'url')).toContain(
      '/api/patient-files/',
    );
    expect(
      fs.existsSync(readJsonString(profilePhotoResponse.body, 'path')),
    ).toBe(true);

    const patientResponse = await request(app.getHttpServer())
      .get(`/patients/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(patientResponse.body).toEqual(
      expect.objectContaining({
        profilePhotoFileId: readJsonString(profilePhotoResponse.body, 'id'),
        profilePhotoUrl: readJsonString(profilePhotoResponse.body, 'url'),
      }),
    );

    await request(app.getHttpServer())
      .delete(
        `/patient-files/${readJsonString(profilePhotoResponse.body, 'id')}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(
      fs.existsSync(readJsonString(profilePhotoResponse.body, 'path')),
    ).toBe(false);

    const patientWithoutProfilePhoto = await request(app.getHttpServer())
      .get(`/patients/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(patientWithoutProfilePhoto.body).toEqual(
      expect.objectContaining({
        profilePhotoFileId: null,
        profilePhotoUrl: null,
      }),
    );
  });

  it('returns minimum clinic operations reports', async () => {
    const appointmentReportFrom = '2026-09-28T00:00:00.000Z';
    const appointmentReportTo = '2026-09-29T00:00:00.000Z';

    const appointmentsReport = await request(app.getHttpServer())
      .get('/common/reports/appointments')
      .query({
        from: appointmentReportFrom,
        to: appointmentReportTo,
        professionalMembershipId: membershipId,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(
      readJsonValue(appointmentsReport.body, 'total'),
    ).toBeGreaterThanOrEqual(1);

    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const incomeReport = await request(app.getHttpServer())
      .get('/common/reports/income')
      .query({ from, to })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(Number(readJsonString(incomeReport.body, 'total'))).toBeGreaterThan(
      0,
    );

    const pendingReport = await request(app.getHttpServer())
      .get('/common/reports/pending-payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(
      Number(readJsonString(pendingReport.body, 'totalPending')),
    ).toBeGreaterThan(0);

    const treatmentsReport = await request(app.getHttpServer())
      .get('/common/reports/active-treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-clinic-id', clinicId)
      .expect(HttpStatus.OK);

    expect(
      readJsonValue(treatmentsReport.body, 'count'),
    ).toBeGreaterThanOrEqual(1);
  });
});
