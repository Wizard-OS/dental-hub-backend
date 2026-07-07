import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { OutboundMessage } from './entities/outbound-message.entity';
import { CreateOutboundMessageDto } from './dto/create-outbound-message.dto';
import { UpdateOutboundMessageDto } from './dto/update-outbound-message.dto';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MessageTemplate } from '../message-templates/entities/message-template.entity';
import { OutboundMessageStatus } from './interfaces/outbound-message-status.enum';

@Injectable()
export class OutboundMessagesService {
  constructor(
    @InjectRepository(OutboundMessage)
    private readonly outboundMessageRepository: Repository<OutboundMessage>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(MessageTemplate)
    private readonly messageTemplateRepository: Repository<MessageTemplate>,
  ) {}

  async create(clinicId: string, dto: CreateOutboundMessageDto) {
    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    if (dto.patientId)
      await this.assertPatientInClinic(dto.patientId, clinicId);
    if (dto.appointmentId)
      await this.assertAppointmentInClinic(dto.appointmentId, clinicId);
    if (dto.templateId)
      await this.assertTemplateInClinic(dto.templateId, clinicId);

    const outboundMessage = this.outboundMessageRepository.create({
      ...dto,
      clinicId,
      payloadJson: dto.payloadJson ?? {},
      status: dto.status ?? OutboundMessageStatus.QUEUED,
    });

    return await this.outboundMessageRepository.save(outboundMessage);
  }

  async findAll(clinicId: string) {
    return await this.outboundMessageRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Invalid outbound message id');

    const outboundMessage = await this.outboundMessageRepository.findOne({
      where: { id, clinicId },
    });

    if (!outboundMessage) {
      throw new NotFoundException(`Outbound message with id ${id} not found`);
    }

    return outboundMessage;
  }

  async update(clinicId: string, id: string, dto: UpdateOutboundMessageDto) {
    const outboundMessage = await this.findOne(clinicId, id);

    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    if (dto.patientId)
      await this.assertPatientInClinic(dto.patientId, clinicId);
    if (dto.appointmentId)
      await this.assertAppointmentInClinic(dto.appointmentId, clinicId);
    if (dto.templateId)
      await this.assertTemplateInClinic(dto.templateId, clinicId);

    Object.assign(outboundMessage, dto);

    if (dto.status === OutboundMessageStatus.SENT && !outboundMessage.sentAt) {
      outboundMessage.sentAt = new Date();
    }

    return await this.outboundMessageRepository.save(outboundMessage);
  }

  async remove(clinicId: string, id: string) {
    const outboundMessage = await this.findOne(clinicId, id);
    outboundMessage.status = OutboundMessageStatus.CANCELLED;
    await this.outboundMessageRepository.save(outboundMessage);
    return { message: `Outbound message ${id} cancelled` };
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
        'Appointment does not belong to the requested clinic',
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
        'Message template does not belong to the requested clinic',
      );
    }
  }
}
