import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';

import { Clinic } from './entities/clinic.entity';
import { UpdateAppointmentSettingsDto } from './dto/update-appointment-settings.dto';
import { AppointmentSettingsPolicy } from './appointment-settings.policy';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ClinicPermission } from '../auth/interfaces';
import { hasClinicPermission } from '../auth/utils/clinic-permissions';

export type AppointmentSettings = Required<UpdateAppointmentSettingsDto>;
export type WorkingHoursContainer = Record<string, unknown> & {
  appointmentSettings?: Partial<AppointmentSettings>;
};
export type ClinicScheduleContext = {
  clinicId: string;
  membershipId: string;
  role: ClinicMembershipRole;
  permissionsJson?: Record<string, boolean>;
};
export type ResolvedAppointmentAvailability = {
  timezone: string;
  settings: AppointmentSettings;
  overrides?: UpdateAppointmentSettingsDto;
  inheritedFromClinic?: boolean;
};

@Injectable()
export class AppointmentAvailabilityService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    private readonly settingsPolicy = new AppointmentSettingsPolicy(),
  ) {}

  async getClinicSettings(scopedClinicId: string, id: string) {
    this.ensureClinicScope(scopedClinicId, id);
    const clinic = await this.findClinic(id);
    return this.normalizeAppointmentSettings(clinic.workingHoursJson);
  }

  async updateClinicSettings(
    scopedClinicId: string,
    id: string,
    dto: UpdateAppointmentSettingsDto,
  ) {
    this.ensureClinicScope(scopedClinicId, id);
    const clinic = await this.findClinic(id);
    const current = this.normalizeAppointmentSettings(clinic.workingHoursJson);
    const next = this.mergeAppointmentSettings(current, dto);

    this.validateAppointmentSettings(next);

    clinic.workingHoursJson = {
      ...(this.isObject(clinic.workingHoursJson)
        ? clinic.workingHoursJson
        : {}),
      appointmentSettings: next,
    };

    await this.clinicRepository.save(clinic);
    return next;
  }

  async getProfessionalSettings(
    context: ClinicScheduleContext,
    id: string,
    membershipId: string,
  ) {
    this.ensureClinicScope(context.clinicId, id);
    this.assertCanViewProfessionalSchedule(context, membershipId);

    const resolved = await this.resolveProfessionalAvailability(
      id,
      membershipId,
    );

    return {
      settings: resolved.settings,
      overrides: resolved.overrides ?? {},
      inheritedFromClinic: resolved.inheritedFromClinic ?? true,
    };
  }

  async updateProfessionalSettings(
    context: ClinicScheduleContext,
    id: string,
    membershipId: string,
    dto: UpdateAppointmentSettingsDto,
  ) {
    this.ensureClinicScope(context.clinicId, id);
    this.assertCanEditProfessionalSchedule(context, membershipId);

    const clinic = await this.findClinic(id);
    const professional = await this.findActiveMembership(id, membershipId);
    const clinicSettings = this.normalizeAppointmentSettings(
      clinic.workingHoursJson,
    );
    const currentOverrides = this.normalizeProfessionalOverrides(
      professional.appointmentSettingsJson,
    );
    const overrides = this.mergeProfessionalOverrides(currentOverrides, dto);
    const settings = this.mergeProfessionalSettings(clinicSettings, overrides);

    this.validateAppointmentSettings(settings);

    professional.appointmentSettingsJson = this.isEmptyPatch(overrides)
      ? null
      : (overrides as Record<string, unknown>);
    await this.clinicMembershipRepository.save(professional);

    return {
      settings,
      overrides,
      inheritedFromClinic: this.isEmptyPatch(overrides),
    };
  }

  async resolveProfessionalAvailability(
    clinicId: string,
    membershipId: string,
  ): Promise<ResolvedAppointmentAvailability> {
    const clinic = await this.findClinic(clinicId);
    const professional = await this.findActiveMembership(
      clinicId,
      membershipId,
    );
    const clinicSettings = this.normalizeAppointmentSettings(
      clinic.workingHoursJson,
    );
    const overrides = this.normalizeProfessionalOverrides(
      professional.appointmentSettingsJson,
    );
    const settings = this.mergeProfessionalSettings(clinicSettings, overrides);

    this.validateAppointmentSettings(settings);

    return {
      timezone: clinic.timezone,
      settings,
      overrides,
      inheritedFromClinic: this.isEmptyPatch(overrides),
    };
  }

  assertAppointmentWithinAvailability(
    availability: ResolvedAppointmentAvailability,
    startTime: Date | string,
    endTime: Date | string,
  ) {
    return this.settingsPolicy.assertAppointmentWithinAvailability(
      availability,
      startTime,
      endTime,
    );
  }

  normalizeAppointmentSettings(
    workingHoursJson: Record<string, unknown> | null | undefined,
  ): AppointmentSettings {
    return this.settingsPolicy.normalizeAppointmentSettings(workingHoursJson);
  }

  mergeAppointmentSettings(
    base: AppointmentSettings,
    patch: UpdateAppointmentSettingsDto,
  ): AppointmentSettings {
    return this.settingsPolicy.mergeAppointmentSettings(base, patch);
  }

  mergeProfessionalOverrides(
    current: UpdateAppointmentSettingsDto,
    patch: UpdateAppointmentSettingsDto,
  ): UpdateAppointmentSettingsDto {
    return this.settingsPolicy.mergeProfessionalOverrides(current, patch);
  }

  validateAppointmentSettings(settings: AppointmentSettings) {
    return this.settingsPolicy.validateAppointmentSettings(settings);
  }

  normalizeProfessionalOverrides(
    value: Record<string, unknown> | null | undefined,
  ): UpdateAppointmentSettingsDto {
    return this.settingsPolicy.normalizeProfessionalOverrides(value);
  }

  isEmptyPatch(value: UpdateAppointmentSettingsDto) {
    return this.settingsPolicy.isEmptyPatch(value);
  }

  private mergeProfessionalSettings(
    clinicSettings: AppointmentSettings,
    overrides: UpdateAppointmentSettingsDto,
  ): AppointmentSettings {
    return this.settingsPolicy.mergeProfessionalSettings(
      clinicSettings,
      overrides,
    );
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return this.settingsPolicy.isObject(value);
  }

  private async findClinic(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinic id');
    }

    const clinic = await this.clinicRepository.findOne({
      where: { id, isActive: true },
    });
    if (!clinic) throw new NotFoundException(`Clinic with id ${id} not found`);

    return clinic;
  }

  private async findActiveMembership(clinicId: string, membershipId: string) {
    if (!isUUID(membershipId)) {
      throw new BadRequestException('Invalid clinic membership id');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { id: membershipId, clinicId, isActive: true },
    });

    if (!membership) {
      throw new NotFoundException('Professional membership not found');
    }

    return membership;
  }

  private ensureClinicScope(scopedClinicId: string, id: string) {
    if (scopedClinicId !== id) {
      throw new BadRequestException(
        'Clinic id does not match x-clinic-id scope',
      );
    }
  }

  private assertCanViewProfessionalSchedule(
    context: ClinicScheduleContext,
    membershipId: string,
  ) {
    if (
      context.membershipId === membershipId ||
      this.canManageSchedule(context)
    ) {
      return;
    }

    throw new ForbiddenException('Cannot view this professional schedule');
  }

  private assertCanEditProfessionalSchedule(
    context: ClinicScheduleContext,
    membershipId: string,
  ) {
    if (
      context.membershipId === membershipId ||
      this.canManageSchedule(context)
    ) {
      return;
    }

    throw new ForbiddenException('Cannot edit this professional schedule');
  }

  private canManageSchedule(context: ClinicScheduleContext) {
    return hasClinicPermission(
      context.role,
      context.permissionsJson,
      ClinicPermission.manageSchedule,
    );
  }
}
