import { apiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Reminder } from './entities/reminder.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MessageTemplate } from '../message-templates/entities/message-template.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderType } from './interfaces/reminder-type.enum';
import { ReminderStatus } from './interfaces/reminder-status.enum';

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(MessageTemplate)
    private readonly messageTemplateRepository: Repository<MessageTemplate>,
  ) {}

  async create(clinicId: string, dto: CreateReminderDto) {
    await this.assertAppointmentInClinic(dto.appointmentId, clinicId);

    if (dto.templateId) {
      await this.assertTemplateInClinic(dto.templateId, clinicId);
    }

    const reminder = this.reminderRepository.create({
      ...dto,
      scheduledAt: new Date(dto.scheduledAt),
      type: dto.type ?? ReminderType.EMAIL,
      status: dto.status ?? ReminderStatus.SCHEDULED,
      sentAt: null,
      error: null,
    });

    return await this.reminderRepository.save(reminder);
  }

  async findAll(clinicId: string) {
    return await this.reminderRepository
      .createQueryBuilder('reminder')
      .innerJoinAndSelect('reminder.appointment', 'appointment')
      .where('appointment.clinicId = :clinicId', { clinicId })
      .orderBy('reminder.scheduledAt', 'DESC')
      .getMany();
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id))
      throw new BadRequestException(
        apiMessage('api.messages.invalid_reminder_id'),
      );

    const reminder = await this.reminderRepository
      .createQueryBuilder('reminder')
      .innerJoinAndSelect('reminder.appointment', 'appointment')
      .where('reminder.id = :id', { id })
      .andWhere('appointment.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!reminder) {
      throw new NotFoundException(
        apiMessage('api.messages.reminder_with_id_not_found', { id: id }),
      );
    }

    return reminder;
  }

  async update(clinicId: string, id: string, dto: UpdateReminderDto) {
    const reminder = await this.findOne(clinicId, id);

    if (dto.appointmentId && dto.appointmentId !== reminder.appointmentId) {
      await this.assertAppointmentInClinic(dto.appointmentId, clinicId);
    }

    if (dto.templateId) {
      await this.assertTemplateInClinic(dto.templateId, clinicId);
    }

    Object.assign(reminder, dto);

    if (dto.scheduledAt) {
      reminder.scheduledAt = new Date(dto.scheduledAt);
    }

    if (dto.status === ReminderStatus.SENT && !reminder.sentAt) {
      reminder.sentAt = new Date();
    }

    return await this.reminderRepository.save(reminder);
  }

  async remove(clinicId: string, id: string) {
    const reminder = await this.findOne(clinicId, id);
    reminder.status = ReminderStatus.CANCELLED;
    await this.reminderRepository.save(reminder);
    return {
      message: apiMessage('api.messages.reminder_cancelled', { id: id }),
    };
  }

  private async assertAppointmentInClinic(
    appointmentId: string,
    clinicId: string,
  ) {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId, clinicId },
      select: { id: true },
    });

    if (!appointment) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.appointment_does_not_belong_to_the_requested_clinic',
        ),
      );
    }
  }

  private async assertTemplateInClinic(templateId: string, clinicId: string) {
    const template = await this.messageTemplateRepository.findOne({
      where: { id: templateId, clinicId },
      select: { id: true },
    });

    if (!template) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.message_template_does_not_belong_to_the_requested_clinic',
        ),
      );
    }
  }
}
