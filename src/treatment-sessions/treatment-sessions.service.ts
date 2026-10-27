import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';

import { ClinicalRecord } from '../clinical-records/entities/clinical-record.entity';
import { ListQueryDto } from '../common/dtos/list-query.dto';
import { apiMessage } from '../common/i18n/api-message';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';
import { Treatment } from '../treatments/entities/treatment.entity';
import { CreateTreatmentSessionDto } from './dto/create-treatment-session.dto';
import { UpdateTreatmentSessionDto } from './dto/update-treatment-session.dto';
import { TreatmentSession } from './entities/treatment-session.entity';

@Injectable()
export class TreatmentSessionsService {
  constructor(
    private readonly patientAccessService: PatientAccessService,
    @InjectRepository(TreatmentSession)
    private readonly treatmentSessionRepository: Repository<TreatmentSession>,

    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,

    @InjectRepository(ClinicalRecord)
    private readonly clinicalRecordRepository: Repository<ClinicalRecord>,
  ) {}

  async create(context: ClinicAccessContext, dto: CreateTreatmentSessionDto) {
    this.patientAccessService.assertCanManageClinical(context);
    const treatment = await this.findTreatmentInClinic(
      dto.treatmentId,
      context.clinicId,
    );
    const record = await this.findClinicalRecordInClinic(
      dto.clinicalRecordId,
      context.clinicId,
    );

    if (treatment.patientId !== record.patientId) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.treatment_and_clinical_record_must_belong_to_the_same_patient',
        ),
      );
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      treatment.patientId,
    );
    const session = this.treatmentSessionRepository.create({
      ...dto,
      performedAt: new Date(dto.performedAt),
    });

    return await this.treatmentSessionRepository.save(session);
  }

  async findAll(context: ClinicAccessContext, pagination = new ListQueryDto()) {
    const query = this.treatmentSessionRepository
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.treatment', 'treatment')
      .innerJoinAndSelect('session.clinicalRecord', 'record')
      .innerJoin('patients', 'patient', 'patient.id = record.patientId')
      .where('patient.clinicId = :clinicId', { clinicId: context.clinicId })
      .orderBy('session.performedAt', 'DESC')
      .addOrderBy('session.id', 'DESC');

    this.patientAccessService.applyPatientAccessFilter(
      query,
      'patient',
      context,
    );
    const [items, total] = await query
      .skip(pagination.offset)
      .take(pagination.limit)
      .getManyAndCount();

    return { items, total, limit: pagination.limit, offset: pagination.offset };
  }

  async findOne(context: ClinicAccessContext, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException(
        apiMessage('api.messages.invalid_treatment_session_id'),
      );
    }

    const session = await this.treatmentSessionRepository
      .createQueryBuilder('session')
      .innerJoinAndSelect('session.treatment', 'treatment')
      .innerJoinAndSelect('session.clinicalRecord', 'record')
      .innerJoin('patients', 'patient', 'patient.id = record.patientId')
      .where('session.id = :id', { id })
      .andWhere('patient.clinicId = :clinicId', { clinicId: context.clinicId })
      .getOne();

    if (!session) {
      throw new NotFoundException(
        apiMessage('api.messages.treatment_session_with_id_not_found', {
          id: id,
        }),
      );
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      session.clinicalRecord.patientId,
    );

    return session;
  }

  async update(
    context: ClinicAccessContext,
    id: string,
    dto: UpdateTreatmentSessionDto,
  ) {
    const session = await this.findOne(context, id);

    const treatmentId = dto.treatmentId ?? session.treatmentId;
    const clinicalRecordId = dto.clinicalRecordId ?? session.clinicalRecordId;

    this.patientAccessService.assertCanManageClinical(context);
    const treatment = await this.findTreatmentInClinic(
      treatmentId,
      context.clinicId,
    );
    const record = await this.findClinicalRecordInClinic(
      clinicalRecordId,
      context.clinicId,
    );

    if (treatment.patientId !== record.patientId) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.treatment_and_clinical_record_must_belong_to_the_same_patient',
        ),
      );
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      treatment.patientId,
    );
    Object.assign(session, dto);

    if (dto.performedAt) {
      session.performedAt = new Date(dto.performedAt);
    }

    return await this.treatmentSessionRepository.save(session);
  }

  async remove(context: ClinicAccessContext, id: string) {
    this.patientAccessService.assertCanManageClinical(context);
    const session = await this.findOne(context, id);

    await this.treatmentSessionRepository.remove(session);

    return {
      message: apiMessage('api.messages.treatment_session_removed', { id: id }),
    };
  }

  private async findTreatmentInClinic(treatmentId: string, clinicId: string) {
    const treatment = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoin('patients', 'patient', 'patient.id = treatment.patientId')
      .where('treatment.id = :treatmentId', { treatmentId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!treatment) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.treatment_does_not_belong_to_the_requested_clinic',
          { treatmentId: treatmentId },
        ),
      );
    }

    return treatment;
  }

  private async findClinicalRecordInClinic(
    clinicalRecordId: string,
    clinicId: string,
  ) {
    const record = await this.clinicalRecordRepository
      .createQueryBuilder('record')
      .innerJoin('record.patient', 'patient')
      .where('record.id = :clinicalRecordId', { clinicalRecordId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!record) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.clinical_record_by_id_does_not_belong_to_clinic',
          { clinicalRecordId: clinicalRecordId },
        ),
      );
    }

    return record;
  }
}
