import { apiMessage, type ApiMessage } from '../common/i18n/api-message';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { Patient } from '../patients/entities/patient.entity';
import { MembershipPlanCode } from './interfaces/membership-plan-code.enum';

type LimitValue = number | null;

export interface MembershipLimits {
  professionalUsers: LimitValue;
  totalUsers: LimitValue;
  activePatients: LimitValue;
  storageBytes: LimitValue;
  messagingCreditsMonthlyIncluded: LimitValue;
}

export interface MembershipUsage {
  professionalUsers: number;
  totalUsers: number;
  activePatients: number;
  storageBytes: number;
  messagingCreditsMonthlyIncluded: number;
}

const PLAN_LIMITS: Record<MembershipPlanCode, MembershipLimits> = {
  [MembershipPlanCode.free]: {
    professionalUsers: 1,
    totalUsers: 2,
    activePatients: null,
    storageBytes: 512 * 1024 * 1024,
    messagingCreditsMonthlyIncluded: 100,
  },
  [MembershipPlanCode.premium]: {
    professionalUsers: 10,
    totalUsers: 20,
    activePatients: null,
    storageBytes: 50 * 1024 * 1024 * 1024,
    messagingCreditsMonthlyIncluded: null,
  },
};

const MVP_ENTITLEMENTS = {
  basicClinicConfiguration: true,
  oneOperationalSite: true,
  basicRoles: true,
  dailyWeeklySchedule: true,
  patientRecords: true,
  clinicalHistory: true,
  basicOdontogram: true,
  treatmentPlans: true,
  simpleEstimates: true,
  basicPayments: true,
  clinicalFiles: true,
  basicReminders: true,
  minimumReports: true,
  googleCalendar: false,
  patientPortal: false,
  onlinePayments: false,
  messagingCredits: false,
  checkout: false,
};

@Injectable()
export class MembershipEntitlementsService {
  constructor(
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientFile)
    private readonly patientFileRepository: Repository<PatientFile>,
  ) {}

  getLimits(planCode: MembershipPlanCode): MembershipLimits {
    return PLAN_LIMITS[planCode];
  }

  getEntitlements(checkoutAvailable: boolean) {
    return { ...MVP_ENTITLEMENTS, checkout: checkoutAvailable };
  }

  async getUsage(clinicId: string): Promise<MembershipUsage> {
    const [totalUsers, professionalUsers, activePatients, storage] =
      await Promise.all([
        this.clinicMembershipRepository.count({
          where: { clinicId, isActive: true, user: { isActive: true } },
          relations: { user: true },
        }),
        this.clinicMembershipRepository
          .createQueryBuilder('membership')
          .innerJoin('membership.user', 'user')
          .where('membership.clinicId = :clinicId', { clinicId })
          .andWhere('membership.isActive = true')
          .andWhere('user.isActive = true')
          .andWhere('membership.role IN (:...roles)', {
            roles: [
              ClinicMembershipRole.odontologist,
              ClinicMembershipRole.specialist,
            ],
          })
          .getCount(),
        this.patientRepository.count({ where: { clinicId } }),
        this.patientFileRepository
          .createQueryBuilder('file')
          .select('COALESCE(SUM(file.size), 0)', 'total')
          .innerJoin('file.patient', 'patient')
          .where('patient.clinicId = :clinicId', { clinicId })
          .getRawOne<{ total: string }>(),
      ]);

    return {
      professionalUsers,
      totalUsers,
      activePatients,
      storageBytes: Number(storage?.total ?? 0),
      messagingCreditsMonthlyIncluded: 0,
    };
  }

  buildWarnings(
    limits: MembershipLimits,
    usage: MembershipUsage,
  ): Record<string, { at80Percent: boolean; blocked: boolean }> {
    return Object.entries(limits).reduce(
      (warnings, [key, limit]) => {
        if (limit == null || key === 'messagingCreditsMonthlyIncluded') {
          return warnings;
        }

        const used = usage[key as keyof MembershipUsage];
        const ratio = used / limit;
        warnings[key] = {
          at80Percent: ratio >= 0.8,
          blocked: used >= limit,
        };
        return warnings;
      },
      {} as Record<string, { at80Percent: boolean; blocked: boolean }>,
    );
  }

  assertMembershipCapacity(usage: MembershipUsage, limits: MembershipLimits) {
    this.assertLimitAvailable(
      limits.totalUsers,
      usage.totalUsers,
      apiMessage('api.messages.user_limit_reached_for_current_membership'),
    );
  }

  assertProfessionalCapacity(usage: MembershipUsage, limits: MembershipLimits) {
    this.assertLimitAvailable(
      limits.professionalUsers,
      usage.professionalUsers,
      apiMessage(
        'api.messages.professional_limit_reached_for_current_membership',
      ),
    );
  }

  assertStorageCapacity(
    usage: MembershipUsage,
    limits: MembershipLimits,
    incomingBytes: number,
  ) {
    if (
      limits.storageBytes != null &&
      usage.storageBytes + incomingBytes > limits.storageBytes
    ) {
      throw new BadRequestException(
        apiMessage('api.messages.storage_limit_reached_for_current_membership'),
      );
    }
  }

  private assertLimitAvailable(
    limit: LimitValue,
    currentUsage: number,
    message: ApiMessage,
  ) {
    if (limit != null && currentUsage >= limit) {
      throw new BadRequestException(message);
    }
  }
}
