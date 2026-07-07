import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Appointment } from './entities/appointment.entity';
import { AppointmentType } from './entities/appointment-type.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CreateAppointmentTypeDto } from './dto/create-appointment-type.dto';
import { UpdateAppointmentTypeDto } from './dto/update-appointment-type.dto';
import { AppointmentStatus } from './interfaces/AppointmentStatus.enum';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(AppointmentType)
    private readonly appointmentTypeRepository: Repository<AppointmentType>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  async create(clinicId: string, dto: CreateAppointmentDto) {
    this.ensureClinicScope(clinicId, dto.clinicId);
    this.validateTimeWindow(dto.startTime, dto.endTime);

    await this.assertPatientInClinic(dto.patientId, clinicId);
    await this.assertMembershipInClinic(dto.professionalMembershipId, clinicId);
    await this.assertUserMembershipInClinic(dto.dentistId, clinicId);
    await this.assertAppointmentTypeInClinic(dto.appointmentTypeId, clinicId);

    await this.assertNoOverlap(
      clinicId,
      dto.startTime,
      dto.endTime,
      dto.professionalMembershipId,
      dto.dentistId,
    );

    try {
      const appointment = this.appointmentRepository.create({
        ...dto,
        clinicId,
        status: dto.status ?? AppointmentStatus.SCHEDULED,
      });
      return await this.appointmentRepository.save(appointment);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll(clinicId: string) {
    return await this.appointmentRepository.find({
      where: { clinicId },
      relations: ['patient', 'appointmentType', 'professionalMembership'],
      order: { startTime: 'ASC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id)) throw new BadRequestException('Invalid appointment id');

    const appointment = await this.appointmentRepository.findOne({
      where: { id, clinicId },
      relations: ['patient', 'appointmentType', 'professionalMembership'],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with id ${id} not found`);
    }

    return appointment;
  }

  async update(clinicId: string, id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.findOne(clinicId, id);

    const nextStart = dto.startTime ?? appointment.startTime;
    const nextEnd = dto.endTime ?? appointment.endTime;
    this.validateTimeWindow(nextStart, nextEnd);

    if (dto.patientId)
      await this.assertPatientInClinic(dto.patientId, clinicId);
    if (dto.professionalMembershipId !== undefined) {
      await this.assertMembershipInClinic(
        dto.professionalMembershipId,
        clinicId,
      );
    }
    if (dto.dentistId !== undefined) {
      await this.assertUserMembershipInClinic(dto.dentistId, clinicId);
    }
    if (dto.appointmentTypeId !== undefined) {
      await this.assertAppointmentTypeInClinic(dto.appointmentTypeId, clinicId);
    }

    await this.assertNoOverlap(
      clinicId,
      nextStart,
      nextEnd,
      dto.professionalMembershipId ??
        appointment.professionalMembershipId ??
        undefined,
      dto.dentistId ?? appointment.dentistId,
      id,
    );

    Object.assign(appointment, dto);

    try {
      return await this.appointmentRepository.save(appointment);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(clinicId: string, id: string) {
    const appointment = await this.findOne(clinicId, id);
    await this.appointmentRepository.remove(appointment);
    return { message: `Appointment ${id} removed` };
  }

  async createType(clinicId: string, dto: CreateAppointmentTypeDto) {
    this.ensureClinicScope(clinicId, dto.clinicId);
    try {
      const appointmentType = this.appointmentTypeRepository.create({
        ...dto,
        clinicId,
      });
      return await this.appointmentTypeRepository.save(appointmentType);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findTypes(clinicId: string) {
    return await this.appointmentTypeRepository.find({
      where: { clinicId },
      order: { name: 'ASC' },
    });
  }

  async updateType(
    clinicId: string,
    id: string,
    dto: UpdateAppointmentTypeDto,
  ) {
    if (!isUUID(id))
      throw new BadRequestException('Invalid appointment type id');

    const appointmentType = await this.appointmentTypeRepository.findOne({
      where: { id, clinicId },
    });

    if (!appointmentType) {
      throw new NotFoundException(`Appointment type with id ${id} not found`);
    }

    if (dto.clinicId) this.ensureClinicScope(clinicId, dto.clinicId);

    Object.assign(appointmentType, dto);
    return await this.appointmentTypeRepository.save(appointmentType);
  }

  async removeType(clinicId: string, id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Invalid appointment type id');

    const appointmentType = await this.appointmentTypeRepository.findOne({
      where: { id, clinicId },
    });

    if (!appointmentType) {
      throw new NotFoundException(`Appointment type with id ${id} not found`);
    }

    appointmentType.isActive = false;
    return await this.appointmentTypeRepository.save(appointmentType);
  }

  private ensureClinicScope(headerClinicId: string, bodyClinicId?: string) {
    if (bodyClinicId && headerClinicId !== bodyClinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }
  }

  private validateTimeWindow(startTime: Date, endTime: Date) {
    if (new Date(startTime) >= new Date(endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }
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

  private async assertMembershipInClinic(
    membershipId: string | undefined,
    clinicId: string,
  ) {
    if (!membershipId) return;

    const membership = await this.clinicMembershipRepository.findOne({
      where: { id: membershipId, clinicId, isActive: true },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        'Professional membership does not belong to the requested clinic',
      );
    }
  }

  private async assertUserMembershipInClinic(
    userId: string | undefined,
    clinicId: string,
  ) {
    if (!userId) return;

    const membership = await this.clinicMembershipRepository.findOne({
      where: { userId, clinicId, isActive: true, user: { isActive: true } },
      relations: { user: true },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException(
        'Dentist/user does not belong to the requested clinic',
      );
    }
  }

  private async assertAppointmentTypeInClinic(
    appointmentTypeId: string | undefined,
    clinicId: string,
  ) {
    if (!appointmentTypeId) return;

    const appointmentType = await this.appointmentTypeRepository.findOne({
      where: { id: appointmentTypeId, clinicId, isActive: true },
      select: { id: true },
    });

    if (!appointmentType) {
      throw new BadRequestException(
        'Appointment type does not belong to the requested clinic',
      );
    }
  }

  private async assertNoOverlap(
    clinicId: string,
    startTime: Date,
    endTime: Date,
    professionalMembershipId?: string,
    dentistId?: string,
    excludeAppointmentId?: string,
  ) {
    if (!professionalMembershipId && !dentistId) {
      return;
    }

    const overlapQuery = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.clinicId = :clinicId', { clinicId })
      .andWhere('appointment.startTime < :endTime', { endTime })
      .andWhere('appointment.endTime > :startTime', { startTime })
      .andWhere('appointment.status != :cancelled', {
        cancelled: AppointmentStatus.CANCELLED,
      });

    if (excludeAppointmentId) {
      overlapQuery.andWhere('appointment.id != :excludeAppointmentId', {
        excludeAppointmentId,
      });
    }

    if (professionalMembershipId && dentistId) {
      overlapQuery.andWhere(
        '(appointment.professionalMembershipId = :professionalMembershipId OR appointment.dentistId = :dentistId)',
        { professionalMembershipId, dentistId },
      );
    } else if (professionalMembershipId) {
      overlapQuery.andWhere(
        'appointment.professionalMembershipId = :professionalMembershipId',
        { professionalMembershipId },
      );
    } else if (dentistId) {
      overlapQuery.andWhere('appointment.dentistId = :dentistId', {
        dentistId,
      });
    }

    const overlap = await overlapQuery.getOne();

    if (overlap) {
      throw new BadRequestException(
        'Appointment overlaps with an existing slot',
      );
    }
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException((error as Record<string, unknown>).detail);
    }

    throw new InternalServerErrorException('Please check server logs');
  }
}
