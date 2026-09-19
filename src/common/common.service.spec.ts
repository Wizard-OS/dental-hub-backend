import { CommonService } from './common.service';
import { InvoiceStatus } from '../invoices/InvoiceStatus/InvoiceStatus.enum';
import { ReminderStatus } from '../reminders/interfaces/reminder-status.enum';

type RawOne = Record<string, string | number | null>;
type RawMany = Record<string, string | number | null>[];

function queryBuilder({
  rawOne,
  rawMany,
  count,
}: {
  rawOne?: RawOne;
  rawMany?: RawMany;
  count?: number;
} = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawOne),
    getRawMany: jest.fn().mockResolvedValue(rawMany ?? []),
    getCount: jest.fn().mockResolvedValue(count ?? 0),
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
}: {
  invoiceSummary?: RawOne;
  paidSummary?: RawOne;
  expenseSummary?: RawOne;
  appointmentsCount?: number;
  remindersCount?: number;
  invoiceStatusRows?: RawMany;
  reminderStatusRows?: RawMany;
} = {}) {
  const invoiceSummaryQuery = queryBuilder({ rawOne: invoiceSummary });
  const invoiceStatusQuery = queryBuilder({ rawMany: invoiceStatusRows });
  const paidQuery = queryBuilder({ rawOne: paidSummary });
  const expenseQuery = queryBuilder({ rawOne: expenseSummary });
  const reminderCountQuery = queryBuilder({ count: remindersCount });
  const reminderStatusQuery = queryBuilder({ rawMany: reminderStatusRows });

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
    count: jest.fn().mockResolvedValue(appointmentsCount),
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
  });
});
