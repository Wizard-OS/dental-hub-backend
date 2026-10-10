import { apiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Treatment } from './entities/treatment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';

@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    private readonly patientAccessService: PatientAccessService,
  ) {}

  async create(context: ClinicAccessContext, dto: CreateTreatmentDto) {
    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(
      context,
      dto.patientId,
    );
    await this.assertDoctorInClinic(dto.doctorId, context.clinicId);
    if (dto.professionalMembershipId) {
      await this.assertMembershipInClinic(
        dto.professionalMembershipId,
        context.clinicId,
      );
    }
    if (dto.invoiceId) {
      await this.assertInvoiceForPatient(
        dto.invoiceId,
        dto.patientId,
        context.clinicId,
      );
    }

    const treatment = this.treatmentRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });

    return await this.treatmentRepository.save(treatment);
  }

  async findAll(context: ClinicAccessContext) {
    const treatments = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoinAndSelect('treatment.sessions', 'sessions')
      .innerJoin('patients', 'patient', 'patient.id = treatment.patientId')
      .where('patient.clinicId = :clinicId', { clinicId: context.clinicId })
      .orderBy('treatment.id', 'DESC')
      .getMany();

    const allowed: Treatment[] = [];
    for (const treatment of treatments) {
      try {
        await this.patientAccessService.assertPatientAccessible(
          context,
          treatment.patientId,
        );
        allowed.push(treatment);
      } catch {
        // Filter inaccessible patients out of collection results.
      }
    }
    return allowed;
  }

  async findOne(context: ClinicAccessContext, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException(
        apiMessage('api.messages.invalid_treatment_id'),
      );
    }

    const treatment = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.sessions', 'sessions')
      .innerJoin('patients', 'patient', 'patient.id = treatment.patientId')
      .where('treatment.id = :id', { id })
      .andWhere('patient.clinicId = :clinicId', {
        clinicId: context.clinicId,
      })
      .getOne();

    if (!treatment) {
      throw new NotFoundException(
        apiMessage('api.messages.treatment_with_id_not_found', { id: id }),
      );
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      treatment.patientId,
    );

    return treatment;
  }

  async update(
    context: ClinicAccessContext,
    id: string,
    dto: UpdateTreatmentDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    const treatment = await this.findOne(context, id);

    if (dto.patientId && dto.patientId !== treatment.patientId) {
      await this.patientAccessService.assertPatientAccessible(
        context,
        dto.patientId,
      );
    }

    if (dto.doctorId && dto.doctorId !== treatment.doctorId) {
      await this.assertDoctorInClinic(dto.doctorId, context.clinicId);
    }

    if (
      dto.professionalMembershipId &&
      dto.professionalMembershipId !== treatment.professionalMembershipId
    ) {
      await this.assertMembershipInClinic(
        dto.professionalMembershipId,
        context.clinicId,
      );
    }

    const nextPatientId = dto.patientId ?? treatment.patientId;
    const nextInvoiceId = dto.invoiceId ?? treatment.invoiceId;
    if (nextInvoiceId) {
      await this.assertInvoiceForPatient(
        nextInvoiceId,
        nextPatientId,
        context.clinicId,
      );
    }

    Object.assign(treatment, dto);
    return await this.treatmentRepository.save(treatment);
  }

  async remove(context: ClinicAccessContext, id: string) {
    this.patientAccessService.assertCanManageClinical(context);
    const treatment = await this.findOne(context, id);
    treatment.isActive = false;
    await this.treatmentRepository.save(treatment);
    return {
      message: apiMessage('api.messages.treatment_archived', { id: id }),
    };
  }

  private async assertPatientInClinic(patientId: string, clinicId: string) {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, clinicId },
      select: { id: true },
    });

    if (!patient) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.patient_does_not_belong_to_the_requested_clinic',
        ),
      );
    }
  }

  private async assertDoctorInClinic(doctorId: string, clinicId: string) {
    const membership = await this.clinicMembershipRepository
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .where('membership.clinicId = :clinicId', { clinicId })
      .andWhere('membership.userId = :doctorId', { doctorId })
      .andWhere('membership.isActive = true')
      .andWhere('user.isActive = true')
      .getOne();

    if (!membership) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.doctor_user_with_id_does_not_belong_to_the_requested_clinic',
          { doctorId: doctorId },
        ),
      );
    }
  }

  private async assertMembershipInClinic(
    membershipId: string,
    clinicId: string,
  ) {
    const membership = await this.clinicMembershipRepository.findOne({
      where: { id: membershipId, clinicId, isActive: true },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        apiMessage('api.messages.membership_by_id_does_not_belong_to_clinic', {
          membershipId: membershipId,
        }),
      );
    }
  }

  private async assertInvoiceForPatient(
    invoiceId: string,
    patientId: string,
    clinicId: string,
  ) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, patientId, clinicId },
      select: { id: true },
    });

    if (!invoice) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.invoice_does_not_belong_to_patient_and_clinic_scope',
        ),
      );
    }
  }
}
