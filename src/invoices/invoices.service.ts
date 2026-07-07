import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Patient } from '../patients/entities/patient.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceItemDto } from './dto/create-invoice-item.dto';
import { InvoiceStatus } from './InvoiceStatus/InvoiceStatus.enum';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async create(clinicId: string, dto: CreateInvoiceDto) {
    this.ensureClinicScope(clinicId, dto.clinicId);

    await this.assertPatientInClinic(dto.patientId, clinicId);

    const { subtotal, totalAmount } = this.computeTotals(dto);

    try {
      const invoice = this.invoiceRepository.create({
        ...dto,
        clinicId,
        subtotal,
        totalAmount,
      });

      const savedInvoice = await this.invoiceRepository.save(invoice);

      if (dto.items?.length) {
        const items = dto.items.map((item) =>
          this.invoiceItemRepository.create({
            ...item,
            invoiceId: savedInvoice.id,
            lineTotal: this.computeLineTotal(item.qty, item.unitPrice),
          }),
        );

        await this.invoiceItemRepository.save(items);
      }

      return await this.findOne(clinicId, savedInvoice.id);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll(clinicId: string) {
    const invoices = await this.invoiceRepository.find({
      where: { clinicId },
      relations: ['payments', 'items', 'patient'],
      order: { issuedAt: 'DESC' },
    });

    return invoices.map((invoice) => this.resolveInvoiceStatus(invoice));
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id)) throw new BadRequestException('Invalid invoice id');

    const invoice = await this.invoiceRepository.findOne({
      where: { id, clinicId },
      relations: ['payments', 'items', 'patient'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id ${id} not found`);
    }

    return this.resolveInvoiceStatus(invoice);
  }

  async update(clinicId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(clinicId, id);

    if (dto.clinicId) this.ensureClinicScope(clinicId, dto.clinicId);
    if (dto.patientId)
      await this.assertPatientInClinic(dto.patientId, clinicId);

    const merged = {
      subtotal: dto.subtotal ?? invoice.subtotal,
      discount: dto.discount ?? invoice.discount,
      tax: dto.tax ?? invoice.tax,
      totalAmount: dto.totalAmount ?? invoice.totalAmount,
    };

    const { subtotal, totalAmount } = this.computeTotals(merged);

    Object.assign(invoice, dto, { subtotal, totalAmount });

    const savedInvoice = await this.invoiceRepository.save(invoice);
    return this.resolveInvoiceStatus(savedInvoice);
  }

  async remove(clinicId: string, id: string) {
    const invoice = await this.findOne(clinicId, id);
    invoice.status = InvoiceStatus.CANCELLED;
    await this.invoiceRepository.save(invoice);
    return { message: `Invoice ${id} cancelled` };
  }

  async addItem(
    clinicId: string,
    invoiceId: string,
    dto: CreateInvoiceItemDto,
  ) {
    const invoice = await this.findOne(clinicId, invoiceId);

    const item = this.invoiceItemRepository.create({
      ...dto,
      invoiceId: invoice.id,
      lineTotal: this.computeLineTotal(dto.qty, dto.unitPrice),
    });

    await this.invoiceItemRepository.save(item);

    return await this.recalculateInvoiceTotals(invoice.id, clinicId);
  }

  async removeItem(clinicId: string, invoiceId: string, itemId: string) {
    const invoice = await this.findOne(clinicId, invoiceId);

    const item = await this.invoiceItemRepository.findOne({
      where: { id: itemId, invoiceId: invoice.id },
    });

    if (!item) {
      throw new NotFoundException(`Invoice item ${itemId} not found`);
    }

    await this.invoiceItemRepository.remove(item);

    return await this.recalculateInvoiceTotals(invoice.id, clinicId);
  }

  async recalculateStatus(invoiceId: string) {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['payments'],
    });

    if (!invoice) return;

    const resolved = this.resolveInvoiceStatus(invoice);
    await this.invoiceRepository.update(invoiceId, { status: resolved.status });
  }

  private async recalculateInvoiceTotals(invoiceId: string, clinicId: string) {
    const invoice = await this.findOne(clinicId, invoiceId);

    const subtotalRaw = invoice.items.reduce(
      (acc, item) => acc + Number(item.lineTotal),
      0,
    );

    invoice.subtotal = subtotalRaw.toFixed(2);

    const totalRaw =
      subtotalRaw - Number(invoice.discount) + Number(invoice.tax);
    invoice.totalAmount = totalRaw.toFixed(2);

    await this.invoiceRepository.save(invoice);

    return await this.findOne(clinicId, invoiceId);
  }

  private computeLineTotal(qty: number, unitPrice: string) {
    return (qty * Number(unitPrice)).toFixed(2);
  }

  private computeTotals(input: {
    subtotal: string;
    discount: string;
    tax: string;
    totalAmount: string;
    items?: { qty: number; unitPrice: string }[];
  }) {
    const subtotalFromItems =
      input.items?.reduce(
        (acc, item) => acc + item.qty * Number(item.unitPrice),
        0,
      ) ?? Number(input.subtotal);

    const subtotal = subtotalFromItems.toFixed(2);
    const totalRaw =
      subtotalFromItems - Number(input.discount) + Number(input.tax);
    const totalAmount = totalRaw.toFixed(2);

    return {
      subtotal,
      totalAmount,
    };
  }

  private resolveInvoiceStatus(invoice: Invoice) {
    if (invoice.status === InvoiceStatus.CANCELLED) {
      return invoice;
    }

    const paidAmount = invoice.payments?.reduce(
      (acc, payment) => acc + Number(payment.amount),
      0,
    );

    const total = Number(invoice.totalAmount);

    if (paidAmount >= total && total > 0) {
      invoice.status = InvoiceStatus.PAID;
      return invoice;
    }

    if (paidAmount > 0 && paidAmount < total) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
      return invoice;
    }

    if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) {
      invoice.status = InvoiceStatus.OVERDUE;
      return invoice;
    }

    invoice.status = InvoiceStatus.PENDING;
    return invoice;
  }

  private ensureClinicScope(headerClinicId: string, bodyClinicId?: string) {
    if (bodyClinicId && headerClinicId !== bodyClinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
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

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException((error as Record<string, unknown>).detail);
    }

    throw new InternalServerErrorException('Please check server logs');
  }
}
