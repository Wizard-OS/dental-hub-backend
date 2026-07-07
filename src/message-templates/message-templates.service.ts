import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { MessageTemplate } from './entities/message-template.entity';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageTemplateStatus } from './interfaces/message-template-status.enum';

@Injectable()
export class MessageTemplatesService {
  constructor(
    @InjectRepository(MessageTemplate)
    private readonly messageTemplateRepository: Repository<MessageTemplate>,
  ) {}

  async create(clinicId: string, dto: CreateMessageTemplateDto) {
    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    const template = this.messageTemplateRepository.create({
      ...dto,
      clinicId,
      status: dto.status ?? MessageTemplateStatus.ACTIVE,
    });

    return await this.messageTemplateRepository.save(template);
  }

  async findAll(clinicId: string) {
    return await this.messageTemplateRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id))
      throw new BadRequestException('Invalid message template id');

    const template = await this.messageTemplateRepository.findOne({
      where: { id, clinicId },
    });

    if (!template) {
      throw new NotFoundException(`Message template with id ${id} not found`);
    }

    return template;
  }

  async update(clinicId: string, id: string, dto: UpdateMessageTemplateDto) {
    const template = await this.findOne(clinicId, id);

    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    Object.assign(template, dto);
    return await this.messageTemplateRepository.save(template);
  }

  async remove(clinicId: string, id: string) {
    const template = await this.findOne(clinicId, id);
    template.status = MessageTemplateStatus.INACTIVE;
    await this.messageTemplateRepository.save(template);
    return { message: `Message template ${id} archived` };
  }
}
