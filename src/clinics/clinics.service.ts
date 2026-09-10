import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Clinic } from './entities/clinic.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import {
  AppointmentAvailabilitySettingsDto,
  AppointmentBookingRulesDto,
  AppointmentBreakDto,
  AppointmentChangeRulesDto,
  AppointmentConfirmationSettingsDto,
  AppointmentReminderSettingsDto,
  AppointmentSchedulingSettingsDto,
  AppointmentSpecialDateDto,
  AppointmentWorkingDayDto,
  UpdateAppointmentSettingsDto,
} from './dto/update-appointment-settings.dto';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { CountriesService } from '../common/countries.service';
import { CountryMetadata } from '../common/interfaces/country-metadata.interface';
import { NotificationChannel } from '../common/interfaces/notification-channel.enum';

type AppointmentSettings = Required<UpdateAppointmentSettingsDto>;
type WorkingHoursContainer = Record<string, unknown> & {
  appointmentSettings?: Partial<AppointmentSettings>;
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

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    private readonly dataSource: DataSource,

    private readonly countriesService: CountriesService,
  ) {}

  async create(ownerUserId: string, createClinicDto: CreateClinicDto) {
    try {
      const clinicData = await this.applyCountryDefaults(createClinicDto);

      return await this.dataSource.transaction(async (manager) => {
        const clinic = manager.create(Clinic, clinicData);
        const savedClinic = await manager.save(clinic);

        const ownerMembership = manager.create(ClinicMembership, {
          clinicId: savedClinic.id,
          userId: ownerUserId,
          role: ClinicMembershipRole.owner,
          permissionsJson: {
            canManageClinic: true,
            canManageTeam: true,
            canManageBilling: true,
            canManageSchedule: true,
          },
        });

        await manager.save(ownerMembership);

        return savedClinic;
      });
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAllForUser(userId: string) {
    const memberships = await this.clinicMembershipRepository.find({
      where: { userId, isActive: true, clinic: { isActive: true } },
      relations: { clinic: true },
      order: { createdAt: 'DESC' },
    });

    return memberships.map((membership) => ({
      ...membership.clinic,
      membershipId: membership.id,
      membershipRole: membership.role,
      permissionsJson: membership.permissionsJson ?? {},
    }));
  }

  async findOneForUser(userId: string, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinic id');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: {
        clinicId: id,
        userId,
        isActive: true,
        clinic: { isActive: true },
      },
      relations: { clinic: true },
    });

    if (!membership) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

    return {
      ...membership.clinic,
      membershipId: membership.id,
      membershipRole: membership.role,
      permissionsJson: membership.permissionsJson ?? {},
    };
  }

  async findOne(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinic id');
    }

    const clinic = await this.clinicRepository.findOne({
      where: { id, isActive: true },
    });
    if (!clinic) throw new NotFoundException(`Clinic with id ${id} not found`);

    return clinic;
  }

  async update(
    scopedClinicId: string,
    id: string,
    updateClinicDto: UpdateClinicDto,
  ) {
    this.ensureClinicScope(scopedClinicId, id);

    const clinic = await this.findOne(id);
    const clinicData = await this.applyCountryDefaults(updateClinicDto);
    Object.assign(clinic, clinicData);

    try {
      return await this.clinicRepository.save(clinic);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async getAppointmentSettings(scopedClinicId: string, id: string) {
    this.ensureClinicScope(scopedClinicId, id);
    const clinic = await this.findOne(id);
    return this.normalizeAppointmentSettings(clinic.workingHoursJson);
  }

  async updateAppointmentSettings(
    scopedClinicId: string,
    id: string,
    dto: UpdateAppointmentSettingsDto,
  ) {
    this.ensureClinicScope(scopedClinicId, id);
    const clinic = await this.findOne(id);
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

  async remove(scopedClinicId: string, id: string) {
    this.ensureClinicScope(scopedClinicId, id);

    const clinic = await this.findOne(id);
    clinic.isActive = false;
    return await this.clinicRepository.save(clinic);
  }

  private ensureClinicScope(scopedClinicId: string, id: string) {
    if (scopedClinicId !== id) {
      throw new BadRequestException(
        'Clinic id does not match x-clinic-id scope',
      );
    }
  }

  private async applyCountryDefaults<
    T extends CreateClinicDto | UpdateClinicDto,
  >(dto: T): Promise<T & Partial<Clinic>> {
    if (!dto.countryCode) {
      return dto;
    }

    const country = await this.countriesService.findByCode(dto.countryCode);

    return {
      ...dto,
      ...this.mapCountryToClinic(country),
      ...(dto.currency ? { currency: dto.currency } : {}),
    };
  }

  private mapCountryToClinic(country: CountryMetadata): Partial<Clinic> {
    return {
      countryCode: country.countryCode,
      countryName: country.countryName,
      currency: country.defaultCurrency,
      callingCodes: country.callingCodes,
      defaultCallingCode: country.defaultCallingCode,
    };
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

  private normalizeAppointmentSettings(
    workingHoursJson: Record<string, unknown> | null | undefined,
  ): AppointmentSettings {
    const container: WorkingHoursContainer = this.isObject(workingHoursJson)
      ? workingHoursJson
      : {};
    const saved = this.isObject(container.appointmentSettings)
      ? (container.appointmentSettings as Partial<AppointmentSettings>)
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

  private mergeAppointmentSettings(
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

  private validateAppointmentSettings(settings: AppointmentSettings) {
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

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException((error as Record<string, unknown>).detail);
    }

    throw new InternalServerErrorException('Please check server logs');
  }
}
