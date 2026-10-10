import { apiMessage, type ApiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { PaymentMethod } from './entities/payment-method.entity';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  async create(
    userId: string,
    dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const methods = await this.paymentMethodRepository.find({
      where: { userId },
    });
    const isDefault = methods.length === 0;

    const paymentMethod = this.paymentMethodRepository.create({
      ...dto,
      userId,
      isDefault,
    });

    return await this.paymentMethodRepository.save(paymentMethod);
  }

  async findAll(userId: string): Promise<PaymentMethod[]> {
    return await this.paymentMethodRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<PaymentMethod> {
    if (!isUUID(id))
      throw new BadRequestException(
        apiMessage('api.messages.invalid_payment_method_id'),
      );

    const method = await this.paymentMethodRepository.findOne({
      where: { id, userId },
    });

    if (!method) {
      throw new NotFoundException(
        apiMessage('api.messages.payment_method_with_id_not_found', { id: id }),
      );
    }

    return method;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const method = await this.findOne(userId, id);
    Object.assign(method, dto);
    return await this.paymentMethodRepository.save(method);
  }

  async remove(userId: string, id: string): Promise<{ message: ApiMessage }> {
    const method = await this.findOne(userId, id);
    const wasDefault = method.isDefault;

    await this.paymentMethodRepository.remove(method);

    if (wasDefault) {
      const remaining = await this.paymentMethodRepository.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      if (remaining) {
        remaining.isDefault = true;
        await this.paymentMethodRepository.save(remaining);
      }
    }

    return {
      message: apiMessage('api.messages.payment_method_removed', { id: id }),
    };
  }

  async setDefault(userId: string, id: string): Promise<PaymentMethod> {
    const method = await this.findOne(userId, id);

    await this.paymentMethodRepository.update({ userId }, { isDefault: false });

    method.isDefault = true;
    return await this.paymentMethodRepository.save(method);
  }
}
