import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment } from '../../appointments/entities/appointment.entity';
import { ClinicalNote } from '../../clinical-notes/entities/clinical-note.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Treatment } from '../../treatments/entities/treatment.entity';

@Injectable()
export class PatientFileScopeService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(ClinicalNote)
    private readonly clinicalNoteRepository: Repository<ClinicalNote>,

    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,
  ) {}

  async findPatientInClinic(
    patientId: string,
    clinicId: string,
  ): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, clinicId },
      relations: { clinic: true },
    });

    if (!patient) {
      throw new NotFoundException(
        `Patient ${patientId} does not belong to the requested clinic`,
      );
    }

    return patient;
  }

  async assertRelationsForPatient(input: {
    patientId: string;
    clinicId: string;
    appointmentId?: string | null;
    clinicalNoteId?: string | null;
    treatmentId?: string | null;
  }): Promise<void> {
    if (input.appointmentId) {
      await this.assertAppointmentForPatient(
        input.appointmentId,
        input.patientId,
        input.clinicId,
      );
    }

    if (input.clinicalNoteId) {
      await this.assertClinicalNoteForPatient(
        input.clinicalNoteId,
        input.patientId,
        input.clinicId,
      );
    }

    if (input.treatmentId) {
      await this.assertTreatmentForPatient(
        input.treatmentId,
        input.patientId,
        input.clinicId,
      );
    }
  }

  private async assertAppointmentForPatient(
    appointmentId: string,
    patientId: string,
    clinicId: string,
  ) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId, patientId, clinicId },
      select: { id: true },
    });

    if (!appointment) {
      throw new BadRequestException(
        'Appointment does not belong to patient and clinic scope',
      );
    }
  }

  private async assertClinicalNoteForPatient(
    clinicalNoteId: string,
    patientId: string,
    clinicId: string,
  ) {
    const note = await this.clinicalNoteRepository
      .createQueryBuilder('note')
      .innerJoin('note.clinicalRecord', 'record')
      .innerJoin('record.patient', 'patient')
      .where('note.id = :clinicalNoteId', { clinicalNoteId })
      .andWhere('record.patientId = :patientId', { patientId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!note) {
      throw new BadRequestException(
        'Clinical note does not belong to patient and clinic scope',
      );
    }
  }

  private async assertTreatmentForPatient(
    treatmentId: string,
    patientId: string,
    clinicId: string,
  ) {
    const treatment = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoin('treatment.patient', 'patient')
      .where('treatment.id = :treatmentId', { treatmentId })
      .andWhere('treatment.patientId = :patientId', { patientId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!treatment) {
      throw new BadRequestException(
        'Treatment does not belong to patient and clinic scope',
      );
    }
  }
}
