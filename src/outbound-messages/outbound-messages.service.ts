import { apiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

  async create(
    clinicId: string,
    dto: CreateOutboundMessageDto,
    transactionManager?: EntityManager,
  ) {
    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        apiMessage('api.messages.clinicid_does_not_match_x_clinic_id_scope'),
      );
    }

    if (dto.patientId)
      await this.assertPatientInClinic(
        dto.patientId,
        clinicId,
        transactionManager,
      );
    if (dto.appointmentId)
      await this.assertAppointmentInClinic(
        dto.appointmentId,
        clinicId,
        transactionManager,
      );
    if (dto.templateId)
      await this.assertTemplateInClinic(
        dto.templateId,
        clinicId,
        transactionManager,
      );

    const repository = transactionManager
      ? transactionManager.getRepository(OutboundMessage)
      : this.outboundMessageRepository;
    const outboundMessage = repository.create({
      ...dto,
      clinicId,
      payloadJson: dto.payloadJson ?? {},
      status: dto.status ?? OutboundMessageStatus.QUEUED,
    });

    return await repository.save(outboundMessage);
  }

  async findAll(clinicId: string) {
    return await this.outboundMessageRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id))
      throw new BadRequestException(
        apiMessage('api.messages.invalid_outbound_message_id'),
      );

    const outboundMessage = await this.outboundMessageRepository.findOne({
      where: { id, clinicId },
    });

    if (!outboundMessage) {
      throw new NotFoundException(
        apiMessage('api.messages.outbound_message_with_id_not_found', {
          id: id,
        }),
      );
    }

    return outboundMessage;
  }

  async update(clinicId: string, id: string, dto: UpdateOutboundMessageDto) {
    const outboundMessage = await this.findOne(clinicId, id);

    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        apiMessage('api.messages.clinicid_does_not_match_x_clinic_id_scope'),
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
    return {
      message: apiMessage('api.messages.outbound_message_cancelled', {
        id: id,
      }),
    };
  }

  private async assertPatientInClinic(
    patientId: string,
    clinicId: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(Patient)
      : this.patientRepository;
    const patient = await repository.findOne({
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

  private async assertAppointmentInClinic(
    appointmentId: string,
    clinicId: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(Appointment)
      : this.appointmentRepository;
    const appointment = await repository.findOne({
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

  private async assertTemplateInClinic(
    templateId: string,
    clinicId: string,
    manager?: EntityManager,
  ) {
    const repository = manager
      ? manager.getRepository(MessageTemplate)
      : this.messageTemplateRepository;
    const template = await repository.findOne({
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
