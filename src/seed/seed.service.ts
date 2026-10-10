import { apiMessage } from '../common/i18n/api-message';
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import * as bcrypt from 'bcrypt';

import { initialData } from './data/seed-data';
import { User } from '../auth/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AppointmentType } from '../appointments/entities/appointment-type.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { OdontogramEntry } from '../odontogram/entities/odontogram-entry.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';

@Injectable()
export class SeedService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(AppointmentType)
    private readonly appointmentTypeRepository: Repository<AppointmentType>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(OdontogramEntry)
    private readonly odontogramRepository: Repository<OdontogramEntry>,

    @InjectRepository(PatientFile)
    private readonly patientFileRepository: Repository<PatientFile>,
  ) {}

  async runSeed() {
    await this.deleteTables();
    const users = await this.insertUsers();
    const clinics = await this.insertClinics();
    const memberships = await this.insertMemberships(users, clinics);
    const patients = await this.insertPatients(clinics);
    const appointmentTypes = await this.insertAppointmentTypes(clinics);
    await this.insertAppointments(
      patients,
      appointmentTypes,
      memberships,
      clinics,
    );
    const invoices = await this.insertInvoices(patients, clinics);
    await this.insertInvoiceItems(invoices);
    await this.insertPayments(invoices, memberships);
    await this.insertOdontogramEntries(patients, memberships);
    await this.insertPatientFiles(patients, memberships);

    return {
      message: apiMessage('api.messages.seed_executed'),
      summary: {
        clinics: clinics.size,
        users: users.size,
        memberships: memberships.size,
        patients: patients.size,
        appointmentTypes: appointmentTypes.size,
        appointments: initialData.appointments.length,
        invoices: invoices.size,
        invoiceItems: initialData.invoiceItems.length,
        payments: initialData.payments.length,
        odontogramEntries: initialData.odontogramEntries.length,
        patientFiles: initialData.patientFiles.length,
      },
      clinicIds: Object.fromEntries(
        [...clinics.entries()].map(([code, clinic]) => [code, clinic.id]),
      ),
    };
  }

  private async deleteTables() {
    const tables = [
      'payments',
      'patient_files',
      'odontogram_entries',
      'invoice_items',
      'invoices',
      'appointments',
      'appointment_types',
      'patients',
      'clinic_memberships',
      'clinics',
      'users',
    ];

    for (const table of tables) {
      try {
        await this.dataSource.query(
          `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Ignore missing table on partially initialized environments
      }
    }
  }

  private async insertUsers() {
    const dbUsers = await this.userRepository.save(
      await Promise.all(
        initialData.users.map(async (user) =>
          this.userRepository.create({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            password: await bcrypt.hash(user.passwordPlain, 10),
            roles: user.roles,
            profilePhotoUrl: user.profilePhotoUrl,
          }),
        ),
      ),
    );

    return new Map(
      initialData.users.map((user, idx) => [user.code, dbUsers[idx]]),
    );
  }

  private async insertClinics() {
    const dbClinics = await this.clinicRepository.save(
      initialData.clinics.map((clinic) =>
        this.clinicRepository.create({
          name: clinic.name,
          timezone: clinic.timezone,
          countryCode: clinic.countryCode ?? 'UY',
          countryName: clinic.countryName ?? 'Uruguay',
          currency: clinic.currency,
          callingCodes: clinic.callingCodes ?? ['598'],
          defaultCallingCode: clinic.defaultCallingCode ?? '598',
          phone: clinic.phone ?? null,
          email: clinic.email ?? null,
          address: clinic.address ?? null,
          logoUrl: clinic.logoUrl ?? null,
          workingHoursJson: clinic.workingHoursJson ?? {},
        }),
      ),
    );

    return new Map(
      initialData.clinics.map((clinic, idx) => [clinic.code, dbClinics[idx]]),
    );
  }

  private async insertMemberships(
    users: Map<string, User>,
    clinics: Map<string, Clinic>,
  ) {
    const dbMemberships = await this.clinicMembershipRepository.save(
      initialData.memberships.map((membership) =>
        this.clinicMembershipRepository.create({
          clinicId: clinics.get(membership.clinicCode)!.id,
          userId: users.get(membership.userCode)!.id,
          role: membership.role,
          permissionsJson: membership.permissionsJson ?? {},
        }),
      ),
    );

    const byUserCode = new Map<string, ClinicMembership>();
    initialData.memberships.forEach((membership, idx) => {
      byUserCode.set(membership.userCode, dbMemberships[idx]);
    });

    return byUserCode;
  }

  private async insertPatients(clinics: Map<string, Clinic>) {
    const dbPatients = await this.patientRepository.save(
      initialData.patients.map((patient) =>
        this.patientRepository.create({
          clinicId: clinics.get(patient.clinicCode)!.id,
          email: patient.email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          documentId: patient.documentId,
          birthDate: new Date(patient.birthDate),
          gender: patient.gender,
          address: patient.address,
          profession: patient.profession,
          streetAddress: patient.streetAddress,
          addressNumber: patient.addressNumber,
          neighborhood: patient.neighborhood,
          city: patient.city,
          postalCode: patient.postalCode,
          phone: patient.phone,
          emergencyContact: patient.emergencyContact,
          observations: patient.observations,
          medicalHistory: patient.medicalHistory,
          dentalHistory: patient.dentalHistory,
        }),
      ),
    );

    return new Map(
      initialData.patients.map((patient, idx) => [
        patient.code,
        dbPatients[idx],
      ]),
    );
  }

  private async insertAppointmentTypes(clinics: Map<string, Clinic>) {
    const dbTypes = await this.appointmentTypeRepository.save(
      initialData.appointmentTypes.map((type) =>
        this.appointmentTypeRepository.create({
          clinicId: clinics.get(type.clinicCode)!.id,
          name: type.name,
          durationMin: type.durationMin,
          defaultPrice: type.defaultPrice,
          color: type.color ?? '#1f7a8c',
        }),
      ),
    );

    return new Map(
      initialData.appointmentTypes.map((type, idx) => [
        type.code,
        dbTypes[idx],
      ]),
    );
  }

  private async insertAppointments(
    patients: Map<string, Patient>,
    appointmentTypes: Map<string, AppointmentType>,
    memberships: Map<string, ClinicMembership>,
    clinics: Map<string, Clinic>,
  ) {
    await this.appointmentRepository.save(
      initialData.appointments.map((appointment) => {
        const membership = memberships.get(appointment.professionalUserCode)!;
        return this.appointmentRepository.create({
          clinicId: clinics.get(appointment.clinicCode)!.id,
          patientId: patients.get(appointment.patientCode)!.id,
          appointmentTypeId: appointmentTypes.get(
            appointment.appointmentTypeCode,
          )!.id,
          professionalMembershipId: membership.id,
          createdByMembershipId: membership.id,
          description: appointment.description,
          startTime: new Date(appointment.startTime),
          endTime: new Date(appointment.endTime),
          status: appointment.status,
        });
      }),
    );
  }

  private async insertInvoices(
    patients: Map<string, Patient>,
    clinics: Map<string, Clinic>,
  ) {
    const dbInvoices = await this.invoiceRepository.save(
      initialData.invoices.map((invoice) =>
        this.invoiceRepository.create({
          clinicId: clinics.get(invoice.clinicCode)!.id,
          patientId: patients.get(invoice.patientCode)!.id,
          number: invoice.number,
          subtotal: invoice.totalAmount,
          discount: invoice.discount,
          tax: invoice.tax,
          totalAmount: invoice.totalAmount,
          status: invoice.status,
          dueAt: invoice.dueAt ? new Date(invoice.dueAt) : null,
        }),
      ),
    );

    return new Map(
      initialData.invoices.map((invoice, idx) => [
        invoice.code,
        dbInvoices[idx],
      ]),
    );
  }

  private async insertInvoiceItems(invoices: Map<string, Invoice>) {
    await this.invoiceItemRepository.save(
      initialData.invoiceItems.map((item) =>
        this.invoiceItemRepository.create({
          invoiceId: invoices.get(item.invoiceCode)!.id,
          type: item.type,
          description: item.description,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          refId: null,
        }),
      ),
    );
  }

  private async insertPayments(
    invoices: Map<string, Invoice>,
    memberships: Map<string, ClinicMembership>,
  ) {
    await this.paymentRepository.save(
      initialData.payments.map((payment) =>
        this.paymentRepository.create({
          invoiceId: invoices.get(payment.invoiceCode)!.id,
          amount: payment.amount,
          method: payment.method,
          paidAt: new Date(payment.paidAt),
          receivedByMembershipId: payment.receivedByUserCode
            ? (memberships.get(payment.receivedByUserCode)?.id ?? null)
            : null,
          reference: payment.reference ?? null,
          voidedAt: payment.voidedAt ? new Date(payment.voidedAt) : null,
          voidReason: payment.voidReason ?? null,
        }),
      ),
    );
  }

  private async insertOdontogramEntries(
    patients: Map<string, Patient>,
    memberships: Map<string, ClinicMembership>,
  ) {
    await this.odontogramRepository.save(
      initialData.odontogramEntries.map((entry) =>
        this.odontogramRepository.create({
          patientId: patients.get(entry.patientCode)!.id,
          toothCode: entry.toothCode,
          status: entry.status,
          observation: entry.observation ?? null,
          professionalMembershipId: memberships.get(entry.professionalUserCode)!
            .id,
        }),
      ),
    );
  }

  private async insertPatientFiles(
    patients: Map<string, Patient>,
    memberships: Map<string, ClinicMembership>,
  ) {
    await this.patientFileRepository.save(
      initialData.patientFiles.map((file) =>
        this.patientFileRepository.create({
          patientId: patients.get(file.patientCode)!.id,
          uploadedByMembershipId: memberships.get(file.uploadedByUserCode)!.id,
          type: file.type,
          originalName: file.originalName,
          storedName: file.storedName,
          path: file.path,
          url: file.url,
          mimeType: file.mimeType,
          size: file.size,
          description: file.description ?? null,
        }),
      ),
    );
  }
}
