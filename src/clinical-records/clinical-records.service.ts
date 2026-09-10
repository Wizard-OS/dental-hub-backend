import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { ClinicalRecord } from './entities/clinical-record.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateClinicalRecordDto } from './dto/create-clinical-record.dto';
import { UpdateClinicalRecordDto } from './dto/update-clinical-record.dto';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';

@Injectable()
export class ClinicalRecordsService {
  constructor(
    @InjectRepository(ClinicalRecord)
    private readonly clinicalRecordRepository: Repository<ClinicalRecord>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    private readonly patientAccessService: PatientAccessService,
  ) {}

  async create(context: ClinicAccessContext, dto: CreateClinicalRecordDto) {
    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(
      context,
      dto.patientId,
    );

    const existing = await this.clinicalRecordRepository.findOne({
      where: { patientId: dto.patientId },
    });

    if (existing) {
      throw new BadRequestException(
        `Clinical record already exists for patient ${dto.patientId}`,
      );
    }

    const record = this.clinicalRecordRepository.create(dto);
    return await this.clinicalRecordRepository.save(record);
  }

  async findAll(context: ClinicAccessContext) {
    const records = await this.clinicalRecordRepository
      .createQueryBuilder('record')
      .innerJoinAndSelect('record.patient', 'patient')
      .leftJoinAndSelect('record.notes', 'notes')
      .where('patient.clinicId = :clinicId', { clinicId: context.clinicId })
      .orderBy('record.createdAt', 'DESC')
      .getMany();

    const allowed: ClinicalRecord[] = [];
    for (const record of records) {
      try {
        await this.patientAccessService.assertPatientAccessible(
          context,
          record.patientId,
        );
        this.patientAccessService.sanitizePatient(record.patient, context);
        allowed.push(record);
      } catch {
        // Patient access is intentionally filtered out of collection results.
      }
    }
    return allowed;
  }

  async findByPatient(context: ClinicAccessContext, patientId: string) {
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const record = await this.clinicalRecordRepository.findOne({
      where: { patientId },
      relations: { patient: true },
    });
    if (!record) throw new NotFoundException('Clinical record not found');
    this.patientAccessService.sanitizePatient(record.patient, context);
    return record;
  }

  async findOne(context: ClinicAccessContext, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinical record id');
    }

    const record = await this.clinicalRecordRepository
      .createQueryBuilder('record')
      .innerJoinAndSelect('record.patient', 'patient')
      .leftJoinAndSelect('record.notes', 'notes')
      .where('record.id = :id', { id })
      .andWhere('patient.clinicId = :clinicId', {
        clinicId: context.clinicId,
      })
      .getOne();

    if (!record) {
      throw new NotFoundException(`Clinical record with id ${id} not found`);
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      record.patientId,
    );
    this.patientAccessService.sanitizePatient(record.patient, context);

    return record;
  }

  async update(
    context: ClinicAccessContext,
    id: string,
    dto: UpdateClinicalRecordDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    const record = await this.findOne(context, id);

    if (dto.patientId && dto.patientId !== record.patientId) {
      throw new BadRequestException(
        'Cannot move a clinical record to another patient',
      );
    }

    Object.assign(record, dto);
    return await this.clinicalRecordRepository.save(record);
  }

  async remove(context: ClinicAccessContext, id: string) {
    this.patientAccessService.assertCanManageClinical(context);
    const record = await this.findOne(context, id);
    await this.clinicalRecordRepository.remove(record);
    return { message: `Clinical record ${id} removed` };
  }

  private async assertPatientInClinic(patientId: string, clinicId: string) {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, clinicId },
      select: { id: true },
    });

    if (!patient) {
      throw new BadRequestException(
        'Patient does not belong to the requested clinic',
      );
    }
  }
}
