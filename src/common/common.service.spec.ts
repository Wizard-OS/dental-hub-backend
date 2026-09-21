import { CommonService } from './common.service';
import { InvoiceStatus } from '../invoices/InvoiceStatus/InvoiceStatus.enum';
import { ReminderStatus } from '../reminders/interfaces/reminder-status.enum';

type RawOne = Record<string, string | number | null>;
type RawMany = Record<string, string | number | null>[];

function queryBuilder({
  rawOne,
  rawMany,
  count,
  rawOneError,
  rawManyError,
  countError,
}: {
  rawOne?: RawOne;
  rawMany?: RawMany;
  count?: number;
  rawOneError?: unknown;
  rawManyError?: unknown;
  countError?: unknown;
} = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawOne:
      rawOneError === undefined
        ? jest.fn().mockResolvedValue(rawOne)
        : jest.fn().mockRejectedValue(rawOneError),
    getRawMany:
      rawManyError === undefined
        ? jest.fn().mockResolvedValue(rawMany ?? [])
        : jest.fn().mockRejectedValue(rawManyError),
    getCount:
      countError === undefined
        ? jest.fn().mockResolvedValue(count ?? 0)
        : jest.fn().mockRejectedValue(countError),
  };
}

function createService({
  invoiceSummary,
  paidSummary,
  expenseSummary,
  appointmentsCount = 0,
  remindersCount = 0,
  invoiceStatusRows = [],
  reminderStatusRows = [],
  invoiceSummaryError,
  paidSummaryError,
  expenseSummaryError,
  appointmentsCountError,
  remindersCountError,
  invoiceStatusRowsError,
  reminderStatusRowsError,
}: {
  invoiceSummary?: RawOne;
  paidSummary?: RawOne;
  expenseSummary?: RawOne;
  appointmentsCount?: number;
  remindersCount?: number;
  invoiceStatusRows?: RawMany;
  reminderStatusRows?: RawMany;
  invoiceSummaryError?: unknown;
  paidSummaryError?: unknown;
  expenseSummaryError?: unknown;
  appointmentsCountError?: unknown;
  remindersCountError?: unknown;
  invoiceStatusRowsError?: unknown;
  reminderStatusRowsError?: unknown;
} = {}) {
  const invoiceSummaryQuery = queryBuilder({
    rawOne: invoiceSummary,
    rawOneError: invoiceSummaryError,
  });
  const invoiceStatusQuery = queryBuilder({
    rawMany: invoiceStatusRows,
    rawManyError: invoiceStatusRowsError,
  });
  const paidQuery = queryBuilder({
    rawOne: paidSummary,
    rawOneError: paidSummaryError,
  });
  const expenseQuery = queryBuilder({
    rawOne: expenseSummary,
    rawOneError: expenseSummaryError,
  });
  const reminderCountQuery = queryBuilder({
    count: remindersCount,
    countError: remindersCountError,
  });
  const reminderStatusQuery = queryBuilder({
    rawMany: reminderStatusRows,
    rawManyError: reminderStatusRowsError,
  });

  const invoiceRepository = {
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(invoiceSummaryQuery)
      .mockReturnValueOnce(invoiceStatusQuery),
  };
  const paymentRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(paidQuery),
  };
  const appointmentRepository = {
    count:
      appointmentsCountError === undefined
        ? jest.fn().mockResolvedValue(appointmentsCount)
        : jest.fn().mockRejectedValue(appointmentsCountError),
  };
  const expenseRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(expenseQuery),
  };
  const reminderRepository = {
    createQueryBuilder: jest
      .fn()
      .mockReturnValueOnce(reminderCountQuery)
      .mockReturnValueOnce(reminderStatusQuery),
  };
  const treatmentRepository = {};

  const service = new CommonService(
    invoiceRepository as never,
    paymentRepository as never,
    appointmentRepository as never,
    expenseRepository as never,
    reminderRepository as never,
    treatmentRepository as never,
  );

  return {
    service,
    invoiceSummaryQuery,
    invoiceStatusQuery,
    paidQuery,
    expenseQuery,
    reminderCountQuery,
    reminderStatusQuery,
    appointmentRepository,
  };
}

function silenceDashboardWarnings(service: CommonService) {
  return jest
    .spyOn(
      (
        service as unknown as {
          logger: { warn: (...args: unknown[]) => void };
        }
      ).logger,
      'warn',
    )
    .mockImplementation();
}

describe('CommonService', () => {
  describe('getDashboard', () => {
    it('returns zeroed dashboard values when the clinic has no operational data', async () => {
      const { service } = createService({
        invoiceSummary: { total: null, count: '0' },
        paidSummary: { total: null },
        expenseSummary: { total: null, count: '0' },
      });

      const dashboard = await service.getDashboard('clinic-1');

      expect(dashboard.financial).toEqual({
        invoiceTotal: '0.00',
        paidTotal: '0.00',
        expenseTotal: '0.00',
        netTotal: '0.00',
        pendingReceivable: '0.00',
      });
      expect(dashboard.operations).toEqual({
        appointments: 0,
        reminders: 0,
        invoices: 0,
        expenses: 0,
      });
      expect(dashboard.breakdown).toEqual({
        invoicesByStatus: {
          pending: 0,
          partiallyPaid: 0,
          paid: 0,
          overdue: 0,
        },
        remindersByStatus: {
          scheduled: 0,
          sent: 0,
          failed: 0,
        },
      });
      expect(new Date(dashboard.generatedAt).toString()).not.toBe(
        'Invalid Date',
      );
    });

    it('aggregates financial totals, operations, and status breakdowns by clinic', async () => {
      const { service } = createService({
        invoiceSummary: { total: '350.50', count: '4' },
        paidSummary: { total: '175.25' },
        expenseSummary: { total: '30.00', count: '2' },
        appointmentsCount: 7,
        remindersCount: 5,
        invoiceStatusRows: [
          { status: InvoiceStatus.PENDING, count: '1' },
          { status: InvoiceStatus.PARTIALLY_PAID, count: '1' },
          { status: InvoiceStatus.PAID, count: '1' },
          { status: InvoiceStatus.OVERDUE, count: '1' },
          { status: InvoiceStatus.CANCELLED, count: '9' },
        ],
        reminderStatusRows: [
          { status: ReminderStatus.SCHEDULED, count: '2' },
          { status: ReminderStatus.SENT, count: '2' },
          { status: ReminderStatus.FAILED, count: '1' },
          { status: ReminderStatus.CANCELLED, count: '8' },
        ],
      });

      const dashboard = await service.getDashboard('clinic-1');

      expect(dashboard.financial).toEqual({
        invoiceTotal: '350.50',
        paidTotal: '175.25',
        expenseTotal: '30.00',
        netTotal: '145.25',
        pendingReceivable: '175.25',
      });
      expect(dashboard.operations).toEqual({
        appointments: 7,
        reminders: 5,
        invoices: 4,
        expenses: 2,
      });
      expect(dashboard.breakdown.invoicesByStatus).toEqual({
        pending: 1,
        partiallyPaid: 1,
        paid: 1,
        overdue: 1,
      });
      expect(dashboard.breakdown.remindersByStatus).toEqual({
        scheduled: 2,
        sent: 2,
        failed: 1,
      });
    });

    it('scopes paid totals through invoices and excludes voided payments', async () => {
      const { service, paidQuery } = createService({
        invoiceSummary: { total: '100.00', count: '1' },
        paidSummary: { total: '60.00' },
        expenseSummary: { total: '0.00', count: '0' },
      });

      await service.getDashboard('clinic-1');

      expect(paidQuery.innerJoin).toHaveBeenCalledWith(
        'payment.invoice',
        'invoice',
      );
      expect(paidQuery.where).toHaveBeenCalledWith(
        'invoice.clinicId = :clinicId',
        { clinicId: 'clinic-1' },
      );
      expect(paidQuery.andWhere).toHaveBeenCalledWith(
        'payment.voidedAt IS NULL',
      );
    });

    it('falls back to zero appointments when the appointment metric fails', async () => {
      const { service } = createService({
        invoiceSummary: { total: '100.00', count: '1' },
        paidSummary: { total: '60.00' },
        expenseSummary: { total: '10.00', count: '1' },
        appointmentsCount: 7,
        appointmentsCountError: new Error('appointments unavailable'),
      });
      silenceDashboardWarnings(service);

      const dashboard = await service.getDashboard('clinic-1');

      expect(dashboard.operations).toEqual({
        appointments: 0,
        reminders: 0,
        invoices: 1,
        expenses: 1,
      });
    });

    it('falls back to zero reminder status breakdown when that metric fails', async () => {
      const { service } = createService({
        invoiceSummary: { total: '100.00', count: '1' },
        paidSummary: { total: '60.00' },
        expenseSummary: { total: '10.00', count: '1' },
        reminderStatusRowsError: new Error('reminder status unavailable'),
      });
      silenceDashboardWarnings(service);

      const dashboard = await service.getDashboard('clinic-1');

      expect(dashboard.breakdown.remindersByStatus).toEqual({
        scheduled: 0,
        sent: 0,
        failed: 0,
      });
    });

    it('falls back to zero financial values when financial metrics fail', async () => {
      const { service } = createService({
        invoiceSummaryError: new Error('invoice summary unavailable'),
        paidSummaryError: new Error('paid summary unavailable'),
        expenseSummaryError: new Error('expense summary unavailable'),
      });
      silenceDashboardWarnings(service);

      const dashboard = await service.getDashboard('clinic-1');

      expect(dashboard.financial).toEqual({
        invoiceTotal: '0.00',
        paidTotal: '0.00',
        expenseTotal: '0.00',
        netTotal: '0.00',
        pendingReceivable: '0.00',
      });
      expect(dashboard.operations.invoices).toBe(0);
      expect(dashboard.operations.expenses).toBe(0);
    });
  });
});
