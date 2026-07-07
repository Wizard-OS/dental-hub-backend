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

@Injectable()
export class TreatmentsService {
  constructor(
    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  async create(clinicId: string, dto: CreateTreatmentDto) {
    await this.assertPatientInClinic(dto.patientId, clinicId);
    await this.assertDoctorInClinic(dto.doctorId, clinicId);

    const treatment = this.treatmentRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });

    return await this.treatmentRepository.save(treatment);
  }

  async findAll(clinicId: string) {
    return await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoinAndSelect('treatment.sessions', 'sessions')
      .innerJoin('patients', 'patient', 'patient.id = treatment.patientId')
      .where('patient.clinicId = :clinicId', { clinicId })
      .orderBy('treatment.id', 'DESC')
      .getMany();
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid treatment id');
    }

    const treatment = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .leftJoinAndSelect('treatment.sessions', 'sessions')
      .innerJoin('patients', 'patient', 'patient.id = treatment.patientId')
      .where('treatment.id = :id', { id })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!treatment) {
      throw new NotFoundException(`Treatment with id ${id} not found`);
    }

    return treatment;
  }

  async update(clinicId: string, id: string, dto: UpdateTreatmentDto) {
    const treatment = await this.findOne(clinicId, id);

    if (dto.patientId && dto.patientId !== treatment.patientId) {
      await this.assertPatientInClinic(dto.patientId, clinicId);
    }

    if (dto.doctorId && dto.doctorId !== treatment.doctorId) {
      await this.assertDoctorInClinic(dto.doctorId, clinicId);
    }

    Object.assign(treatment, dto);
    return await this.treatmentRepository.save(treatment);
  }

  async remove(clinicId: string, id: string) {
    const treatment = await this.findOne(clinicId, id);
    treatment.isActive = false;
    await this.treatmentRepository.save(treatment);
    return { message: `Treatment ${id} archived` };
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
        `Doctor/user with id ${doctorId} does not belong to the requested clinic`,
      );
    }
  }
}
