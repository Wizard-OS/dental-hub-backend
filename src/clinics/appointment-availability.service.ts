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
import {
  AppointmentAvailabilitySettingsDto,
  AppointmentBreakDto,
  AppointmentSpecialDateDto,
  AppointmentWorkingDayDto,
  UpdateAppointmentSettingsDto,
} from './dto/update-appointment-settings.dto';
import { NotificationChannel } from '../common/interfaces/notification-channel.enum';
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

const dayNames = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const weekdayByName: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

@Injectable()
export class AppointmentAvailabilityService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
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
    const start = this.localDateParts(startTime, availability.timezone);
    const end = this.localDateParts(endTime, availability.timezone);

    if (start.date !== end.date) {
      throw new BadRequestException(
        'Appointment must start and end on the same local day',
      );
    }

    const specialDate = availability.settings.availability.specialDates?.find(
      (date) => date.date === start.date,
    );

    if (specialDate?.isClosed) {
      throw new BadRequestException('Appointment falls on a closed date');
    }

    const workingWindow = specialDate
      ? {
          isOpen: true,
          startTime: specialDate.startTime,
          endTime: specialDate.endTime,
        }
      : availability.settings.availability.weekly?.find(
          (day) => day.dayOfWeek === start.dayOfWeek,
        );

    if (
      !workingWindow?.isOpen ||
      !workingWindow.startTime ||
      !workingWindow.endTime
    ) {
      throw new BadRequestException('Appointment falls outside working hours');
    }

    const startMinutes = start.minutes;
    const endMinutes = end.minutes;
    const openMinutes = this.timeToMinutes(workingWindow.startTime);
    const closeMinutes = this.timeToMinutes(workingWindow.endTime);

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      throw new BadRequestException('Appointment falls outside working hours');
    }

    for (const pause of availability.settings.availability.breaks ?? []) {
      if (!pause.daysOfWeek.includes(start.dayOfWeek)) continue;

      const breakStart = this.timeToMinutes(pause.startTime);
      const breakEnd = this.timeToMinutes(pause.endTime);
      if (startMinutes < breakEnd && endMinutes > breakStart) {
        throw new BadRequestException('Appointment overlaps a schedule break');
      }
    }
  }

  normalizeAppointmentSettings(
    workingHoursJson: Record<string, unknown> | null | undefined,
  ): AppointmentSettings {
    const container: WorkingHoursContainer = this.isObject(workingHoursJson)
      ? workingHoursJson
      : {};
    const saved = this.isObject(container.appointmentSettings)
      ? container.appointmentSettings
      : {};
    const legacyAvailability = this.legacyAvailability(container);
    const defaults = this.defaultAppointmentSettings();

    return this.mergeAppointmentSettings(defaults, {
      ...saved,
      availability: {
        ...legacyAvailability,
        ...(this.isObject(saved.availability) ? saved.availability : {}),
      },
    });
  }

  mergeAppointmentSettings(
    base: AppointmentSettings,
    patch: UpdateAppointmentSettingsDto,
  ): AppointmentSettings {
    const availabilityPatch = patch.availability ?? {};
    const remindersPatch = patch.reminders ?? {};
    const confirmationPatch = patch.confirmation ?? {};

    return {
      availability: {
        ...base.availability,
        ...availabilityPatch,
        weekly: this.normalizeWeekly(
          availabilityPatch.weekly ?? base.availability.weekly,
        ),
        breaks: this.sortBreaks(
          availabilityPatch.breaks ?? base.availability.breaks,
        ),
        specialDates: this.sortSpecialDates(
          availabilityPatch.specialDates ?? base.availability.specialDates,
        ),
      },
      scheduling: {
        ...base.scheduling,
        ...(patch.scheduling ?? {}),
      },
      reminders: {
        ...base.reminders,
        ...remindersPatch,
        channels: remindersPatch.channels ?? base.reminders.channels,
        noticesBeforeMinutes: [
          ...(remindersPatch.noticesBeforeMinutes ??
            base.reminders.noticesBeforeMinutes ??
            []),
        ].sort((a, b) => b - a),
      },
      confirmation: {
        ...base.confirmation,
        ...confirmationPatch,
      },
      bookingRules: {
        ...base.bookingRules,
        ...(patch.bookingRules ?? {}),
      },
      changeRules: {
        ...base.changeRules,
        ...(patch.changeRules ?? {}),
        cancellation: {
          ...base.changeRules.cancellation,
          ...(patch.changeRules?.cancellation ?? {}),
        },
        reschedule: {
          ...base.changeRules.reschedule,
          ...(patch.changeRules?.reschedule ?? {}),
        },
      },
    };
  }

  mergeProfessionalOverrides(
    current: UpdateAppointmentSettingsDto,
    patch: UpdateAppointmentSettingsDto,
  ): UpdateAppointmentSettingsDto {
    return this.pruneEmptyPatch({
      availability:
        current.availability || patch.availability
          ? {
              ...(current.availability ?? {}),
              ...(patch.availability ?? {}),
              weekly:
                patch.availability?.weekly !== undefined
                  ? this.mergeWeeklyOverrides(
                      current.availability?.weekly,
                      patch.availability.weekly,
                    )
                  : current.availability?.weekly,
              breaks:
                patch.availability?.breaks !== undefined
                  ? this.sortBreaks(patch.availability.breaks)
                  : current.availability?.breaks,
              specialDates:
                patch.availability?.specialDates !== undefined
                  ? this.sortSpecialDates(patch.availability.specialDates)
                  : current.availability?.specialDates,
            }
          : undefined,
      scheduling: {
        ...(current.scheduling ?? {}),
        ...(patch.scheduling ?? {}),
      },
      reminders:
        current.reminders || patch.reminders
          ? {
              ...(current.reminders ?? {}),
              ...(patch.reminders ?? {}),
              channels:
                patch.reminders?.channels ?? current.reminders?.channels,
              noticesBeforeMinutes:
                patch.reminders?.noticesBeforeMinutes !== undefined
                  ? [...patch.reminders.noticesBeforeMinutes].sort(
                      (a, b) => b - a,
                    )
                  : current.reminders?.noticesBeforeMinutes,
            }
          : undefined,
      confirmation:
        current.confirmation || patch.confirmation
          ? {
              ...(current.confirmation ?? {}),
              ...(patch.confirmation ?? {}),
            }
          : undefined,
      bookingRules:
        current.bookingRules || patch.bookingRules
          ? {
              ...(current.bookingRules ?? {}),
              ...(patch.bookingRules ?? {}),
            }
          : undefined,
      changeRules:
        current.changeRules || patch.changeRules
          ? {
              ...(current.changeRules ?? {}),
              ...(patch.changeRules ?? {}),
              cancellation:
                current.changeRules?.cancellation ||
                patch.changeRules?.cancellation
                  ? {
                      ...(current.changeRules?.cancellation ?? {}),
                      ...(patch.changeRules?.cancellation ?? {}),
                    }
                  : undefined,
              reschedule:
                current.changeRules?.reschedule || patch.changeRules?.reschedule
                  ? {
                      ...(current.changeRules?.reschedule ?? {}),
                      ...(patch.changeRules?.reschedule ?? {}),
                    }
                  : undefined,
            }
          : undefined,
    });
  }

  validateAppointmentSettings(settings: AppointmentSettings) {
    for (const day of settings.availability.weekly ?? []) {
      if (!day.isOpen) continue;
      if (!day.startTime || !day.endTime) {
        throw new BadRequestException('open working days need start and end');
      }
      this.assertTimeRange(day.startTime, day.endTime, 'working day');
    }

    for (const pause of settings.availability.breaks ?? []) {
      this.assertTimeRange(pause.startTime, pause.endTime, 'break');
    }

    const specialDates = new Set<string>();
    for (const specialDate of settings.availability.specialDates ?? []) {
      if (specialDates.has(specialDate.date)) {
        throw new BadRequestException('specialDates contains duplicated dates');
      }
      specialDates.add(specialDate.date);

      if (!specialDate.isClosed) {
        if (!specialDate.startTime || !specialDate.endTime) {
          throw new BadRequestException(
            'open special dates need start and end',
          );
        }
        this.assertTimeRange(
          specialDate.startTime,
          specialDate.endTime,
          'special date',
        );
      }
    }

    if (
      settings.confirmation.responseDeadlineBeforeMinutes !== undefined &&
      settings.confirmation.requestBeforeMinutes !== undefined &&
      settings.confirmation.responseDeadlineBeforeMinutes >=
        settings.confirmation.requestBeforeMinutes
    ) {
      throw new BadRequestException(
        'confirmation response deadline must be closer to the appointment than the request time',
      );
    }
  }

  normalizeProfessionalOverrides(
    value: Record<string, unknown> | null | undefined,
  ): UpdateAppointmentSettingsDto {
    return this.isObject(value) ? (value as UpdateAppointmentSettingsDto) : {};
  }

  isEmptyPatch(value: UpdateAppointmentSettingsDto) {
    return (
      Object.keys(this.pruneEmptyPatch(value as Record<string, unknown>))
        .length === 0
    );
  }

  private defaultAppointmentSettings(): AppointmentSettings {
    return {
      availability: {
        scope: 'clinic',
        weekly: [
          { dayOfWeek: 1, isOpen: true, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 2, isOpen: true, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 3, isOpen: true, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 4, isOpen: true, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 5, isOpen: true, startTime: '09:00', endTime: '16:00' },
          { dayOfWeek: 6, isOpen: false },
          { dayOfWeek: 7, isOpen: false },
        ],
        breaks: [
          {
            name: 'Almuerzo',
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '13:00',
            endTime: '14:00',
          },
        ],
        specialDates: [],
      },
      scheduling: {
        defaultDurationMin: 30,
        slotIntervalMin: 15,
        bufferBetweenAppointmentsMin: 10,
      },
      reminders: {
        enabled: true,
        channels: [NotificationChannel.WHATSAPP, NotificationChannel.EMAIL],
        noticesBeforeMinutes: [1440, 120],
        messageTemplate:
          'Hola, {nombre}. Te recordamos tu cita de {tipo} el {fecha} a las {hora}.',
      },
      confirmation: {
        enabled: true,
        requestBeforeMinutes: 1440,
        responseDeadlineBeforeMinutes: 120,
        channel: NotificationChannel.WHATSAPP,
        noResponseAction: 'keep_pending',
        messageTemplate:
          'Hola, {nombre}. ¿Confirmas tu cita de {tipo} para el {fecha} a las {hora}?',
      },
      bookingRules: {
        patientBookingEnabled: true,
        minNoticeMinutes: 120,
        maxAdvanceDays: 60,
        maxActiveAppointmentsPerPatient: 3,
        approvalMode: 'automatic',
      },
      changeRules: {
        cancellation: { enabled: true, minNoticeMinutes: 1440 },
        reschedule: {
          enabled: true,
          minNoticeMinutes: 720,
          maxChangesPerAppointment: 2,
        },
        outOfWindowAction: 'contact_clinic',
        notifyProfessional: true,
      },
    };
  }

  private legacyAvailability(
    workingHoursJson: WorkingHoursContainer,
  ): Partial<AppointmentAvailabilitySettingsDto> {
    const weekly = dayNames.map((dayName, index) => {
      const periods = workingHoursJson[dayName];
      const firstPeriod = Array.isArray(periods) ? periods[0] : undefined;
      if (!this.isObject(firstPeriod)) {
        return { dayOfWeek: index + 1, isOpen: false };
      }

      const startTime =
        typeof firstPeriod.from === 'string' ? firstPeriod.from : undefined;
      const endTime =
        typeof firstPeriod.to === 'string' ? firstPeriod.to : undefined;

      return startTime && endTime
        ? { dayOfWeek: index + 1, isOpen: true, startTime, endTime }
        : { dayOfWeek: index + 1, isOpen: false };
    });

    const hasLegacyHours = weekly.some((day) => day.isOpen);
    return hasLegacyHours ? { weekly } : {};
  }

  private mergeProfessionalSettings(
    clinicSettings: AppointmentSettings,
    overrides: UpdateAppointmentSettingsDto,
  ): AppointmentSettings {
    const availabilityPatch = overrides.availability ?? {};
    const remindersPatch = overrides.reminders ?? {};
    const confirmationPatch = overrides.confirmation ?? {};

    return {
      availability: {
        ...clinicSettings.availability,
        ...availabilityPatch,
        weekly: this.mergeWeeklyOverrides(
          clinicSettings.availability.weekly,
          availabilityPatch.weekly,
        ),
        breaks:
          availabilityPatch.breaks !== undefined
            ? this.sortBreaks(availabilityPatch.breaks)
            : clinicSettings.availability.breaks,
        specialDates:
          availabilityPatch.specialDates !== undefined
            ? this.sortSpecialDates(availabilityPatch.specialDates)
            : clinicSettings.availability.specialDates,
      },
      scheduling: {
        ...clinicSettings.scheduling,
        ...(overrides.scheduling ?? {}),
      },
      reminders: {
        ...clinicSettings.reminders,
        ...remindersPatch,
        channels: remindersPatch.channels ?? clinicSettings.reminders.channels,
        noticesBeforeMinutes: [
          ...(remindersPatch.noticesBeforeMinutes ??
            clinicSettings.reminders.noticesBeforeMinutes ??
            []),
        ].sort((a, b) => b - a),
      },
      confirmation: {
        ...clinicSettings.confirmation,
        ...confirmationPatch,
      },
      bookingRules: {
        ...clinicSettings.bookingRules,
        ...(overrides.bookingRules ?? {}),
      },
      changeRules: {
        ...clinicSettings.changeRules,
        ...(overrides.changeRules ?? {}),
        cancellation: {
          ...clinicSettings.changeRules.cancellation,
          ...(overrides.changeRules?.cancellation ?? {}),
        },
        reschedule: {
          ...clinicSettings.changeRules.reschedule,
          ...(overrides.changeRules?.reschedule ?? {}),
        },
      },
    };
  }

  private mergeWeeklyOverrides(
    base: AppointmentWorkingDayDto[] | undefined,
    patch: AppointmentWorkingDayDto[] | undefined,
  ): AppointmentWorkingDayDto[] {
    const byDay = new Map<number, AppointmentWorkingDayDto>();
    for (const day of base ?? []) {
      if (byDay.has(day.dayOfWeek)) {
        throw new BadRequestException('weekly contains duplicated days');
      }
      byDay.set(day.dayOfWeek, day);
    }

    const patchedDays = new Set<number>();
    for (const day of patch ?? []) {
      if (patchedDays.has(day.dayOfWeek)) {
        throw new BadRequestException('weekly contains duplicated days');
      }
      patchedDays.add(day.dayOfWeek);
      byDay.set(day.dayOfWeek, day);
    }

    return Array.from(byDay.values()).sort(
      (left, right) => left.dayOfWeek - right.dayOfWeek,
    );
  }

  private normalizeWeekly(
    weekly: AppointmentWorkingDayDto[] | undefined,
  ): AppointmentWorkingDayDto[] {
    const byDay = new Map<number, AppointmentWorkingDayDto>();
    for (const day of weekly ?? []) {
      if (byDay.has(day.dayOfWeek)) {
        throw new BadRequestException('weekly contains duplicated days');
      }
      byDay.set(day.dayOfWeek, day);
    }

    return Array.from({ length: 7 }, (_, index) => {
      const dayOfWeek = index + 1;
      return byDay.get(dayOfWeek) ?? { dayOfWeek, isOpen: false };
    });
  }

  private sortBreaks(breaks: AppointmentBreakDto[] | undefined) {
    return [...(breaks ?? [])].sort((left, right) => {
      const dayDelta =
        Math.min(...left.daysOfWeek) - Math.min(...right.daysOfWeek);
      return dayDelta || left.startTime.localeCompare(right.startTime);
    });
  }

  private sortSpecialDates(dates: AppointmentSpecialDateDto[] | undefined) {
    return [...(dates ?? [])].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
  }

  private assertTimeRange(startTime: string, endTime: string, label: string) {
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException(
        `${label} startTime must be before endTime`,
      );
    }
  }

  private timeToMinutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private localDateParts(value: Date | string, timeZone: string) {
    const date = new Date(value);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const byType = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    const month = byType.month;
    const day = byType.day;
    const year = byType.year;
    const hours = Number(byType.hour);
    const minutes = Number(byType.minute);

    return {
      date: `${year}-${month}-${day}`,
      dayOfWeek: weekdayByName[byType.weekday],
      minutes: hours * 60 + minutes,
    };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private pruneEmptyPatch<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [
          key,
          this.isObject(entry) ? this.pruneEmptyPatch(entry) : entry,
        ])
        .filter(([, entry]) => {
          if (entry === undefined) return false;
          if (this.isObject(entry)) return Object.keys(entry).length > 0;
          return true;
        }),
    ) as T;
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
