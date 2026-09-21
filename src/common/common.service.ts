import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Reminder } from '../reminders/entities/reminder.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { Treatment } from '../treatments/entities/treatment.entity';
import { InvoiceStatus } from '../invoices/InvoiceStatus/InvoiceStatus.enum';
import { ReminderStatus } from '../reminders/interfaces/reminder-status.enum';
import { DashboardResponse } from './interfaces/dashboard-response.interface';
import { TreatmentStatus } from '../treatments/interfaces/treatment-status.enum';

@Injectable()
export class CommonService {
  private readonly logger = new Logger(CommonService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,

    @InjectRepository(Reminder)
    private readonly reminderRepository: Repository<Reminder>,

    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,
  ) {}

  async getDashboard(clinicId: string): Promise<DashboardResponse> {
    const results = await Promise.allSettled([
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.totalAmount), 0)', 'total')
        .addSelect('COUNT(invoice.id)', 'count')
        .where('invoice.clinicId = :clinicId', { clinicId })
        .getRawOne<{ total: string | number | null; count: string | number }>(),
      this.paymentRepository
        .createQueryBuilder('payment')
        .innerJoin('payment.invoice', 'invoice')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .where('invoice.clinicId = :clinicId', { clinicId })
        .andWhere('payment.voidedAt IS NULL')
        .getRawOne<{ total: string | number | null }>(),
      this.expenseRepository
        .createQueryBuilder('expense')
        .select('COALESCE(SUM(expense.amount), 0)', 'total')
        .addSelect('COUNT(expense.id)', 'count')
        .where('expense.clinicId = :clinicId', { clinicId })
        .getRawOne<{ total: string | number | null; count: string | number }>(),
      this.appointmentRepository.count({ where: { clinicId } }),
      this.reminderRepository
        .createQueryBuilder('reminder')
        .innerJoin('reminder.appointment', 'appointment')
        .where('appointment.clinicId = :clinicId', { clinicId })
        .getCount(),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('invoice.status', 'status')
        .addSelect('COUNT(invoice.id)', 'count')
        .where('invoice.clinicId = :clinicId', { clinicId })
        .groupBy('invoice.status')
        .getRawMany<{ status: InvoiceStatus; count: string | number }>(),
      this.reminderRepository
        .createQueryBuilder('reminder')
        .innerJoin('reminder.appointment', 'appointment')
        .select('reminder.status', 'status')
        .addSelect('COUNT(reminder.id)', 'count')
        .where('appointment.clinicId = :clinicId', { clinicId })
        .groupBy('reminder.status')
        .getRawMany<{ status: ReminderStatus; count: string | number }>(),
    ]);

    const invoiceSummary = this.dashboardMetric(
      results[0],
      'invoiceSummary',
      clinicId,
      undefined,
    );
    const paidSummary = this.dashboardMetric(
      results[1],
      'paidSummary',
      clinicId,
      undefined,
    );
    const expenseSummary = this.dashboardMetric(
      results[2],
      'expenseSummary',
      clinicId,
      undefined,
    );
    const appointmentsCount = this.dashboardMetric(
      results[3],
      'appointmentsCount',
      clinicId,
      0,
    );
    const remindersCount = this.dashboardMetric(
      results[4],
      'remindersCount',
      clinicId,
      0,
    );
    const invoiceStatusRows = this.dashboardMetric(
      results[5],
      'invoiceStatusRows',
      clinicId,
      [],
    );
    const reminderStatusRows = this.dashboardMetric(
      results[6],
      'reminderStatusRows',
      clinicId,
      [],
    );

    const invoiceTotal = this.rawNumber(invoiceSummary?.total);
    const paidTotal = this.rawNumber(paidSummary?.total);
    const expenseTotal = this.rawNumber(expenseSummary?.total);
    const invoicesCount = this.rawNumber(invoiceSummary?.count);
    const expensesCount = this.rawNumber(expenseSummary?.count);
    const invoicesByStatus = this.invoiceStatusBreakdown(invoiceStatusRows);
    const remindersByStatus = this.reminderStatusBreakdown(reminderStatusRows);

    return {
      financial: {
        invoiceTotal: invoiceTotal.toFixed(2),
        paidTotal: paidTotal.toFixed(2),
        expenseTotal: expenseTotal.toFixed(2),
        netTotal: (paidTotal - expenseTotal).toFixed(2),
        pendingReceivable: (invoiceTotal - paidTotal).toFixed(2),
      },
      operations: {
        appointments: appointmentsCount,
        reminders: remindersCount,
        invoices: invoicesCount,
        expenses: expensesCount,
      },
      breakdown: {
        invoicesByStatus,
        remindersByStatus,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private dashboardMetric<T>(
    result: PromiseSettledResult<T>,
    metricName: string,
    clinicId: string,
    fallback: T,
  ): T {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const reason =
      result.reason instanceof Error ? result.reason.stack : result.reason;
    this.logger.warn(
      `Dashboard metric "${metricName}" failed for clinic "${clinicId}". Using fallback value.`,
      reason,
    );

    return fallback;
  }

  private rawNumber(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private invoiceStatusBreakdown(
    rows: { status: InvoiceStatus; count: string | number }[],
  ) {
    const summary = {
      pending: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
    };

    for (const row of rows) {
      const count = this.rawNumber(row.count);
      if (row.status === InvoiceStatus.PENDING) summary.pending = count;
      if (row.status === InvoiceStatus.PARTIALLY_PAID) {
        summary.partiallyPaid = count;
      }
      if (row.status === InvoiceStatus.PAID) summary.paid = count;
      if (row.status === InvoiceStatus.OVERDUE) summary.overdue = count;
    }

    return summary;
  }

  private reminderStatusBreakdown(
    rows: { status: ReminderStatus; count: string | number }[],
  ) {
    const summary = {
      scheduled: 0,
      sent: 0,
      failed: 0,
    };

    for (const row of rows) {
      const count = this.rawNumber(row.count);
      if (row.status === ReminderStatus.SCHEDULED) summary.scheduled = count;
      if (row.status === ReminderStatus.SENT) summary.sent = count;
      if (row.status === ReminderStatus.FAILED) summary.failed = count;
    }

    return summary;
  }

  async getAppointmentsReport(
    clinicId: string,
    filters: {
      from?: string;
      to?: string;
      status?: string;
      professionalMembershipId?: string;
    },
  ) {
    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.appointmentType', 'appointmentType')
      .leftJoinAndSelect(
        'appointment.professionalMembership',
        'professionalMembership',
      )
      .where('appointment.clinicId = :clinicId', { clinicId });

    if (filters.from) {
      query.andWhere('appointment.startTime >= :from', {
        from: filters.from,
      });
    }

    if (filters.to) {
      query.andWhere('appointment.startTime <= :to', { to: filters.to });
    }

    if (filters.status !== undefined) {
      query.andWhere('appointment.status = :status', {
        status: Number.isNaN(Number(filters.status))
          ? filters.status
          : Number(filters.status),
      });
    }

    if (filters.professionalMembershipId) {
      query.andWhere(
        'appointment.professionalMembershipId = :professionalMembershipId',
        { professionalMembershipId: filters.professionalMembershipId },
      );
    }

    const appointments = await query
      .orderBy('appointment.startTime', 'ASC')
      .getMany();

    const byStatus = appointments.reduce<Record<string, number>>(
      (acc, appointment) => {
        const key = String(appointment.status);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      total: appointments.length,
      byStatus,
      appointments,
    };
  }

  async getIncomeReport(
    clinicId: string,
    filters: {
      from?: string;
      to?: string;
    },
  ) {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('payment.patient', 'patient')
      .where('invoice.clinicId = :clinicId', { clinicId })
      .andWhere('payment.voidedAt IS NULL');

    if (filters.from) {
      query.andWhere('payment.paidAt >= :from', { from: filters.from });
    }

    if (filters.to) {
      query.andWhere('payment.paidAt <= :to', { to: filters.to });
    }

    const payments = await query.orderBy('payment.paidAt', 'DESC').getMany();
    const total = payments.reduce(
      (acc, payment) => acc + Number(payment.amount),
      0,
    );

    return {
      total: total.toFixed(2),
      count: payments.length,
      payments,
    };
  }

  async getPendingPaymentsReport(clinicId: string) {
    const invoices = await this.invoiceRepository.find({
      where: { clinicId },
      relations: ['patient', 'payments', 'items'],
      order: { issuedAt: 'DESC' },
    });

    const pending = invoices
      .map((invoice) => {
        const paidAmount =
          invoice.payments?.reduce(
            (acc, payment) =>
              acc + (payment.voidedAt ? 0 : Number(payment.amount)),
            0,
          ) ?? 0;
        const totalAmount = Number(invoice.totalAmount);
        const pendingAmount = totalAmount - paidAmount;

        return {
          invoice,
          totalAmount: totalAmount.toFixed(2),
          paidAmount: paidAmount.toFixed(2),
          pendingAmount: pendingAmount.toFixed(2),
        };
      })
      .filter(
        (item) =>
          Number(item.pendingAmount) > 0 &&
          ![
            InvoiceStatus.CANCELLED,
            InvoiceStatus.REJECTED,
            InvoiceStatus.DRAFT,
          ].includes(item.invoice.status),
      );

    const totalPending = pending.reduce(
      (acc, item) => acc + Number(item.pendingAmount),
      0,
    );

    return {
      totalPending: totalPending.toFixed(2),
      count: pending.length,
      invoices: pending,
    };
  }

  async getActiveTreatmentsReport(clinicId: string) {
    const treatments = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoinAndSelect('treatment.patient', 'patient')
      .where('patient.clinicId = :clinicId', { clinicId })
      .andWhere('treatment.isActive = true')
      .andWhere('treatment.status IN (:...statuses)', {
        statuses: [
          TreatmentStatus.PROPOSED,
          TreatmentStatus.ACCEPTED,
          TreatmentStatus.IN_PROGRESS,
        ],
      })
      .orderBy('treatment.createdAt', 'DESC')
      .getMany();

    return {
      count: treatments.length,
      treatments,
    };
  }
}
