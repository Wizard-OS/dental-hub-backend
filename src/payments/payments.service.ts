import { apiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Payment } from './entities/payment.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { InvoiceStatus } from '../invoices/InvoiceStatus/InvoiceStatus.enum';
import { Treatment } from '../treatments/entities/treatment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,
  ) {}

  async create(clinicId: string, dto: CreatePaymentDto) {
    const invoice = await this.findInvoiceInClinic(dto.invoiceId, clinicId);

    const paidAmount = await this.getPaidAmount(invoice.id);
    const nextPaidAmount = paidAmount + Number(dto.amount);
    const patientId = dto.patientId ?? invoice.patientId;
    const treatmentId = dto.treatmentId ?? invoice.treatmentId ?? null;

    await this.assertPaymentRelationsInScope(
      invoice,
      clinicId,
      patientId,
      treatmentId,
    );

    if (nextPaidAmount > Number(invoice.totalAmount)) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.payment_amount_exceeds_pending_invoice_balance',
        ),
      );
    }

    const payment = this.paymentRepository.create({
      ...dto,
      patientId,
      treatmentId,
      voidedAt: null,
      voidReason: null,
    });
    await this.paymentRepository.save(payment);

    await this.refreshInvoiceStatus(invoice.id);

    return await this.findOne(clinicId, payment.id);
  }

  async findAll(clinicId: string) {
    return await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .where('invoice.clinicId = :clinicId', { clinicId })
      .orderBy('payment.paidAt', 'DESC')
      .getMany();
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id))
      throw new BadRequestException(
        apiMessage('api.messages.invalid_payment_id'),
      );

    const payment = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .where('payment.id = :id', { id })
      .andWhere('invoice.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!payment) {
      throw new NotFoundException(
        apiMessage('api.messages.payment_with_id_not_found', { id: id }),
      );
    }

    return payment;
  }

  async update(clinicId: string, id: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(clinicId, id);
    if (payment.voidedAt) {
      throw new BadRequestException(
        apiMessage('api.messages.voided_payments_cannot_be_updated'),
      );
    }

    const previousInvoiceId = payment.invoiceId;
    const invoice = await this.findInvoiceInClinic(
      dto.invoiceId ?? payment.invoiceId,
      clinicId,
    );

    const patientId = dto.patientId ?? payment.patientId ?? invoice.patientId;
    const treatmentId =
      dto.treatmentId ?? payment.treatmentId ?? invoice.treatmentId ?? null;

    await this.assertPaymentRelationsInScope(
      invoice,
      clinicId,
      patientId,
      treatmentId,
    );

    const paidAmount = await this.getPaidAmount(invoice.id);
    const paidWithoutCurrent =
      invoice.id === payment.invoiceId
        ? paidAmount - Number(payment.amount)
        : paidAmount;
    const nextAmount = Number(dto.amount ?? payment.amount);

    if (paidWithoutCurrent + nextAmount > Number(invoice.totalAmount)) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.payment_amount_exceeds_pending_invoice_balance',
        ),
      );
    }

    Object.assign(payment, dto, { patientId, treatmentId });
    const saved = await this.paymentRepository.save(payment);

    await this.refreshInvoiceStatus(invoice.id);
    if (previousInvoiceId !== invoice.id) {
      await this.refreshInvoiceStatus(previousInvoiceId);
    }

    return saved;
  }

  async remove(clinicId: string, id: string) {
    return this.void(clinicId, id, { reason: 'Deleted through API' });
  }

  async void(clinicId: string, id: string, dto: VoidPaymentDto) {
    const payment = await this.findOne(clinicId, id);

    payment.voidedAt = new Date();
    payment.voidReason = dto.reason;
    await this.paymentRepository.save(payment);

    await this.refreshInvoiceStatus(payment.invoiceId);

    return await this.findOne(clinicId, id);
  }

  private async findInvoiceInClinic(invoiceId: string, clinicId: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, clinicId },
    });

    if (!invoice) {
      throw new BadRequestException(
        apiMessage('api.messages.invoice_does_not_belong_to_clinic_scope'),
      );
    }

    return invoice;
  }

  private async assertPaymentRelationsInScope(
    invoice: Invoice,
    clinicId: string,
    patientId: string | null,
    treatmentId: string | null,
  ) {
    if (patientId !== invoice.patientId) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.payment_patient_does_not_match_invoice_patient',
        ),
      );
    }

    if (!treatmentId) return;

    if (invoice.treatmentId && treatmentId !== invoice.treatmentId) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.payment_treatment_does_not_match_invoice_treatment',
        ),
      );
    }

    const treatment = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoin('treatment.patient', 'patient')
      .where('treatment.id = :treatmentId', { treatmentId })
      .andWhere('treatment.patientId = :patientId', {
        patientId: invoice.patientId,
      })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!treatment) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.payment_treatment_does_not_belong_to_invoice_patient_and_clinic_scope',
        ),
      );
    }
  }

  private async getPaidAmount(invoiceId: string) {
    const payments = await this.paymentRepository.find({
      where: { invoiceId },
      select: { amount: true, voidedAt: true },
    });

    return payments.reduce(
      (acc, payment) => acc + (payment.voidedAt ? 0 : Number(payment.amount)),
      0,
    );
  }

  private async refreshInvoiceStatus(invoiceId: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.status === InvoiceStatus.CANCELLED) return;

    const paidAmount = await this.getPaidAmount(invoiceId);
    const total = Number(invoice.totalAmount);

    if (paidAmount >= total && total > 0) {
      invoice.status = InvoiceStatus.PAID;
    } else if (paidAmount > 0) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    } else if (invoice.status === InvoiceStatus.ACCEPTED) {
      invoice.status = InvoiceStatus.ACCEPTED;
    } else if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) {
      invoice.status = InvoiceStatus.OVERDUE;
    } else {
      invoice.status = InvoiceStatus.PENDING;
    }

    await this.invoiceRepository.save(invoice);
  }
}
