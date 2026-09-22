import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { User } from '../auth/entities/user.entity';
import { ValidRoles } from '../auth/interfaces';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import {
  SupportRequest,
  SupportRequestStatus,
} from '../help-center/entities/support-request.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ClinicSubscription } from '../membership/entities/clinic-subscription.entity';
import { MembershipService } from '../membership/membership.service';
import { QueryBackofficeClinicsDto } from './dto/query-backoffice-clinics.dto';
import { QueryBackofficeUsersDto } from './dto/query-backoffice-users.dto';
import { QueryBackofficeSupportRequestsDto } from './dto/query-backoffice-support-requests.dto';
import { UpdateBackofficeClinicDto } from './dto/update-backoffice-clinic.dto';
import { UpdateBackofficeUserDto } from './dto/update-backoffice-user.dto';
import { UpdateBackofficeSubscriptionDto } from './dto/update-backoffice-subscription.dto';
import { UpdateBackofficeSupportRequestDto } from './dto/update-backoffice-support-request.dto';

@Injectable()
export class BackofficeService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    @InjectRepository(ClinicSubscription)
    private readonly subscriptionRepository: Repository<ClinicSubscription>,

    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,

    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,

    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,

    private readonly membershipService: MembershipService,
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

  async findClinics(queryDto: QueryBackofficeClinicsDto) {
    const { limit = 10, offset = 0, search, status, planCode } = queryDto;
    const query = this.clinicRepository
      .createQueryBuilder('clinic')
      .leftJoinAndSelect('clinic.memberships', 'memberships')
      .leftJoinAndSelect('memberships.user', 'membershipUser')
      .leftJoinAndMapOne(
        'clinic.subscription',
        ClinicSubscription,
        'subscription',
        'subscription.clinicId = clinic.id',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(*)')
            .from(ClinicMembership, 'countMembership')
            .where('countMembership.clinicId = clinic.id'),
        'clinic_membersCount',
      )
      .addSelect(
        (subQuery) =>
          subQuery
            .select('COUNT(*)')
            .from(Patient, 'countPatient')
            .where('countPatient.clinicId = clinic.id'),
        'clinic_patientsCount',
      )
      .orderBy('clinic.createdAt', 'DESC');

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('clinic.name ILIKE :search', { search: `%${search}%` })
            .orWhere('clinic.email ILIKE :search', { search: `%${search}%` })
            .orWhere('clinic.phone ILIKE :search', { search: `%${search}%` });
        }),
      );
    }

    if (status === 'active') {
      query.andWhere('clinic.isActive = true');
    }

    if (status === 'inactive') {
      query.andWhere('clinic.isActive = false');
    }

    if (planCode) {
      query.andWhere('subscription.planCode = :planCode', { planCode });
    }

    const total = await query.getCount();
    const { entities: clinics, raw } = await query
      .skip(offset)
      .take(limit)
      .getRawAndEntities();
    const countsByClinicId = new Map(
      raw.map((row: Record<string, unknown>) => [
        row.clinic_id,
        {
          membersCount: Number(row.clinic_membersCount ?? 0),
          patientsCount: Number(row.clinic_patientsCount ?? 0),
        },
      ]),
    );

    for (const clinic of clinics) {
      Object.assign(clinic, countsByClinicId.get(clinic.id));
    }

    return {
      total,
      limit,
      offset,
      items: clinics.map((clinic) => this.serializeClinicSummary(clinic)),
    };
  }

  async findClinic(id: string): Promise<unknown> {
    this.assertUuid(id, 'Invalid clinic id');

    const clinic = await this.clinicRepository.findOne({
      where: { id },
      relations: {
        memberships: { user: true },
      },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

    const [
      subscription,
      membership,
      patients,
      appointments,
      invoices,
      payments,
      supportRequests,
    ] = await Promise.all([
      this.membershipService.getCurrent(id),
      this.clinicMembershipRepository.count({ where: { clinicId: id } }),
      this.patientRepository.count({ where: { clinicId: id } }),
      this.appointmentRepository.count({ where: { clinicId: id } }),
      this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.totalAmount), 0)', 'total')
        .addSelect('COUNT(invoice.id)', 'count')
        .where('invoice.clinicId = :id', { id })
        .getRawOne<{ total: string; count: string }>(),
      this.paymentRepository
        .createQueryBuilder('payment')
        .innerJoin('payment.invoice', 'invoice')
        .select('COALESCE(SUM(payment.amount), 0)', 'total')
        .addSelect('COUNT(payment.id)', 'count')
        .where('invoice.clinicId = :id', { id })
        .andWhere('payment.voidedAt IS NULL')
        .getRawOne<{ total: string; count: string }>(),
      this.supportRequestRepository
        .createQueryBuilder('request')
        .innerJoinAndSelect('request.user', 'user')
        .innerJoin('user.memberships', 'membership')
        .where('membership.clinicId = :id', { id })
        .orderBy('request.createdAt', 'DESC')
        .take(5)
        .getMany(),
    ]);

    return {
      ...clinic,
      owner: this.findOwner(clinic.memberships),
      subscription,
      metrics: {
        members: membership,
        patients,
        appointments,
        invoices: {
          count: Number(invoices?.count ?? 0),
          totalAmount: Number(invoices?.total ?? 0).toFixed(2),
        },
        payments: {
          count: Number(payments?.count ?? 0),
          totalAmount: Number(payments?.total ?? 0).toFixed(2),
        },
      },
      supportRequests,
    };
  }

  async updateClinic(id: string, dto: UpdateBackofficeClinicDto) {
    this.assertUuid(id, 'Invalid clinic id');

    const clinic = await this.clinicRepository.findOne({ where: { id } });
    if (!clinic) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

    Object.assign(clinic, dto);
    return await this.clinicRepository.save(clinic);
  }

  async findUsers(queryDto: QueryBackofficeUsersDto) {
    const { limit = 10, offset = 0, search, status } = queryDto;
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.memberships', 'memberships')
      .leftJoinAndSelect('memberships.clinic', 'clinic')
      .orderBy('user.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('user.email ILIKE :search', { search: `%${search}%` })
            .orWhere('user.firstName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('user.lastName ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    if (status === 'active') {
      query.andWhere('user.isActive = true');
    }

    if (status === 'inactive') {
      query.andWhere('user.isActive = false');
    }

    const [users, total] = await query.getManyAndCount();

    return {
      total,
      limit,
      offset,
      items: users,
    };
  }

  async findUser(id: string) {
    this.assertUuid(id, 'Invalid user id');

    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        memberships: { clinic: true },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const [sessions, supportRequests] = await Promise.all([
      this.userSessionRepository.find({
        where: { userId: id },
        order: { lastActiveAt: 'DESC' },
        take: 10,
      }),
      this.supportRequestRepository.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    return {
      ...user,
      sessions,
      supportRequests,
    };
  }

  async updateUser(id: string, dto: UpdateBackofficeUserDto) {
    this.assertUuid(id, 'Invalid user id');

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    if (dto.roles && !dto.roles.includes(ValidRoles.user)) {
      dto.roles = [...dto.roles];
    }

    Object.assign(user, dto);
    return await this.userRepository.save(user);
  }

  async updateClinicSubscription(
    id: string,
    dto: UpdateBackofficeSubscriptionDto,
  ): Promise<unknown> {
    this.assertUuid(id, 'Invalid clinic id');

    const clinic = await this.clinicRepository.findOne({
      where: { id },
      select: { id: true },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

    return await this.membershipService.assignManualFromBackoffice(
      id,
      dto.planCode,
      dto.reason,
    );
  }

  async findSupportRequests(queryDto: QueryBackofficeSupportRequestsDto) {
    const { limit = 10, offset = 0, search, status } = queryDto;
    const query = this.supportRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .orderBy('request.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (status) {
      query.andWhere('request.status = :status', { status });
    }

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('request.subject ILIKE :search', {
            search: `%${search}%`,
          })
            .orWhere('request.message ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('request.contactEmail ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    const [items, total] = await query.getManyAndCount();

    return {
      total,
      limit,
      offset,
      items,
    };
  }

  async updateSupportRequest(
    id: string,
    dto: UpdateBackofficeSupportRequestDto,
  ) {
    this.assertUuid(id, 'Invalid support request id');

    const request = await this.supportRequestRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!request) {
      throw new NotFoundException(`Support request with id ${id} not found`);
    }

    request.status = dto.status;
    return await this.supportRequestRepository.save(request);
  }

  private serializeClinicSummary(clinic: Clinic) {
    const dynamicClinic = clinic as Clinic & {
      subscription?: ClinicSubscription | null;
      membersCount?: number;
      patientsCount?: number;
    };

    return {
      id: clinic.id,
      name: clinic.name,
      phone: clinic.phone,
      email: clinic.email,
      address: clinic.address,
      timezone: clinic.timezone,
      countryCode: clinic.countryCode,
      countryName: clinic.countryName,
      currency: clinic.currency,
      callingCodes: clinic.callingCodes,
      defaultCallingCode: clinic.defaultCallingCode,
      isActive: clinic.isActive,
      createdAt: clinic.createdAt,
      updatedAt: clinic.updatedAt,
      owner: this.findOwner(clinic.memberships ?? []),
      membersCount: dynamicClinic.membersCount ?? 0,
      patientsCount: dynamicClinic.patientsCount ?? 0,
      subscription: dynamicClinic.subscription ?? null,
    };
  }

  private findOwner(memberships: ClinicMembership[] = []) {
    const owner = memberships.find(
      (membership) =>
        membership.role === ClinicMembershipRole.owner && membership.isActive,
    );

    if (!owner) return null;

    return {
      membershipId: owner.id,
      userId: owner.userId,
      firstName: owner.user?.firstName,
      lastName: owner.user?.lastName,
      email: owner.user?.email,
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

  private assertUuid(value: string, message: string) {
    if (!isUUID(value)) {
      throw new BadRequestException(message);
    }
  }
}
