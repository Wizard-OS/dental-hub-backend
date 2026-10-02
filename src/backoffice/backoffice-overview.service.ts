import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../auth/entities/user.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ClinicSubscription } from '../membership/entities/clinic-subscription.entity';
import {
  SupportRequest,
  SupportRequestStatus,
} from '../help-center/entities/support-request.entity';

@Injectable()
export class BackofficeOverviewService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ClinicSubscription)
    private readonly subscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,
  ) {}

  async getOverview() {
    const [
      activeClinics,
      inactiveClinics,
      activeUsers,
      inactiveUsers,
      totalInvoices,
      totalPayments,
      subscriptionsByPlan,
      supportRequestsByStatus,
      recentClinics,
      recentUsers,
      recentSupportRequests,
    ] = await Promise.all([
      this.clinicRepository.count({ where: { isActive: true } }),
      this.clinicRepository.count({ where: { isActive: false } }),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { isActive: false } }),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.totalAmount), 0)', 'total')
        .addSelect('COUNT(invoice.id)', 'count')
        .getRawOne<{ total: string; count: string }>(),
      this.paymentRepository
        .createQueryBuilder('payment')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .addSelect('COUNT(payment.id)', 'count')
        .where('payment.voidedAt IS NULL')
        .getRawOne<{ total: string; count: string }>(),
      this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select('subscription.planCode', 'planCode')
        .addSelect('COUNT(subscription.id)', 'count')
        .groupBy('subscription.planCode')
        .getRawMany<{ planCode: string; count: string }>(),
      this.supportRequestRepository
        .createQueryBuilder('request')
        .select('request.status', 'status')
        .addSelect('COUNT(request.id)', 'count')
        .groupBy('request.status')
        .getRawMany<{ status: SupportRequestStatus; count: string }>(),
      this.clinicRepository.find({
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.userRepository.find({
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.supportRequestRepository.find({
        relations: { user: true },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    return {
      totals: {
        clinics: {
          active: activeClinics,
          inactive: inactiveClinics,
          total: activeClinics + inactiveClinics,
        },
        users: {
          active: activeUsers,
          inactive: inactiveUsers,
          total: activeUsers + inactiveUsers,
        },
        invoices: {
          count: Number(totalInvoices?.count ?? 0),
          totalAmount: Number(totalInvoices?.total ?? 0).toFixed(2),
        },
        payments: {
          count: Number(totalPayments?.count ?? 0),
          totalAmount: Number(totalPayments?.total ?? 0).toFixed(2),
        },
      },
      subscriptionsByPlan: this.toCountMap(subscriptionsByPlan, 'planCode'),
      supportRequestsByStatus: this.toCountMap(
        supportRequestsByStatus,
        'status',
      ),
      recentActivity: {
        clinics: recentClinics,
        users: recentUsers,
        supportRequests: recentSupportRequests,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private toCountMap<T extends Record<string, string>>(
    rows: T[],
    key: keyof T,
  ) {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row[key]] = Number(row.count ?? 0);
      return acc;
    }, {});
  }
}
