import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceStatus } from '../invoices/InvoiceStatus/InvoiceStatus.enum';
import { Payment } from '../payments/entities/payment.entity';

export interface BillingHistoryRecord {
  id: string;
  title: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending' | 'overdue';
  iconName: string;
}

@Injectable()
export class BillingHistoryService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getBillingHistory(clinicId: string): Promise<BillingHistoryRecord[]> {
    const [payments, invoices] = await Promise.all([
      this.paymentRepository.find({
        where: { invoice: { clinicId } },
        relations: { invoice: { patient: true }, patient: true },
        order: { paidAt: 'DESC' },
      }),
      this.invoiceRepository.find({
        where: { clinicId },
        relations: { patient: true, payments: true },
        order: { issuedAt: 'DESC' },
      }),
    ]);

    const paymentRecords = payments
      .filter((payment) => !payment.voidedAt)
      .map((payment) => ({
        id: payment.id,
        title: this.billingRecordTitle(payment.invoice),
        date: payment.paidAt.toISOString(),
        amount: this.formatCurrencyAmount(payment.amount),
        status: 'paid' as const,
        iconName: 'receipt',
      }));

    const pendingInvoiceRecords: BillingHistoryRecord[] = invoices.flatMap(
      (invoice) => {
        if (invoice.status === InvoiceStatus.CANCELLED) return [];

        const totalPaid = (invoice.payments ?? [])
          .filter((payment) => !payment.voidedAt)
          .reduce(
            (sum, payment) => sum + this.numericAmount(payment.amount),
            0,
          );
        const remaining = Math.max(
          this.numericAmount(invoice.totalAmount) - totalPaid,
          0,
        );

        if (remaining <= 0) return [];

        const dueAt = invoice.dueAt?.getTime();
        const isOverdue =
          invoice.status === InvoiceStatus.OVERDUE ||
          (typeof dueAt === 'number' && dueAt < Date.now());

        return [
          {
            id: invoice.id,
            title: this.billingRecordTitle(invoice),
            date: (invoice.dueAt ?? invoice.issuedAt).toISOString(),
            amount: this.formatCurrencyAmount(remaining),
            status: isOverdue ? ('overdue' as const) : ('pending' as const),
            iconName: 'receipt',
          },
        ];
      },
    );

    return [...paymentRecords, ...pendingInvoiceRecords].sort(
      (a, b) => Date.parse(b.date) - Date.parse(a.date),
    );
  }

  async exportBillingHistoryPdf(clinicId: string) {
    const records = await this.getBillingHistory(clinicId);
    const generatedAt = new Date();
    const lines = [
      'DentalHub - Billing History',
      `Generated: ${generatedAt.toISOString()}`,
      '',
      records.length ? 'Date        Status    Amount       Description' : '',
      ...records.map((record) => {
        const date = record.date.slice(0, 10);
        const status = record.status.toUpperCase().padEnd(8, ' ');
        const amount = record.amount.padStart(10, ' ');
        return `${date}  ${status}  ${amount}  ${record.title}`;
      }),
      ...(records.length ? [] : ['No billing records found.']),
    ];

    return {
      filename: `billing-history-${generatedAt.toISOString().slice(0, 10)}.pdf`,
      content: this.createSimplePdf(lines),
    };
  }

  private billingRecordTitle(invoice?: Invoice | null) {
    if (!invoice) return 'Payment';

    const patientName = [invoice.patient?.firstName, invoice.patient?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return patientName
      ? `${patientName} - ${invoice.number}`
      : `Invoice ${invoice.number}`;
  }

  private numericAmount(amount: string | number | null | undefined) {
    const value =
      typeof amount === 'number' ? amount : Number.parseFloat(amount ?? '0');

    return Number.isFinite(value) ? value : 0;
  }

  private formatCurrencyAmount(amount: string | number) {
    return this.numericAmount(amount).toFixed(2);
  }

  private createSimplePdf(lines: string[]) {
    const pageLines = lines.slice(0, 42);
    const textCommands = pageLines
      .map((line, index) => {
        const y = 780 - index * 16;
        return `1 0 0 1 50 ${y} Tm (${this.escapePdfText(line)}) Tj`;
      })
      .join('\n');
    const stream = `BT\n/F1 11 Tf\n${textCommands}\nET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.slice(1).forEach((offset) => {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf);
  }

  private escapePdfText(value: string) {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }
}
