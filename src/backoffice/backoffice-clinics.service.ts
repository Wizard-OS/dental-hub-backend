import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brackets } from 'typeorm';
import { isUUID } from 'class-validator';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ClinicSubscription } from '../membership/entities/clinic-subscription.entity';
import { MembershipService } from '../membership/membership.service';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { SupportRequest } from '../help-center/entities/support-request.entity';
import { QueryBackofficeClinicsDto } from './dto/query-backoffice-clinics.dto';
import { UpdateBackofficeClinicDto } from './dto/update-backoffice-clinic.dto';
import { UpdateBackofficeSubscriptionDto } from './dto/update-backoffice-subscription.dto';

@Injectable()
export class BackofficeClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,
    private readonly membershipService: MembershipService,
  ) {}

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

  private assertUuid(value: string, message: string) {
    if (!isUUID(value)) {
      throw new BadRequestException(message);
    }
  }
}
