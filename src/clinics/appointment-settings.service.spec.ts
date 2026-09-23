import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { ClinicsService } from './clinics.service';
import { NotificationChannel } from '../common/interfaces/notification-channel.enum';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';

describe('ClinicsService appointment settings', () => {
  const professionalMembershipId = '9e9b76d6-d03a-4abf-a607-f46ffbc70148';
  const otherMembershipId = '407ff4cc-af76-4cc1-a2a3-86f93952214b';
  const clinic = {
    id: '69d0cbe5-f7e6-4928-99a9-cdf15c986b4f',
    isActive: true,
    workingHoursJson: {
      monday: [{ from: '08:30', to: '17:30' }],
      friday: [{ from: '09:00', to: '16:00' }],
    },
  };

  function serviceWithClinic(
    value = clinic,
    memberships = [
      {
        id: professionalMembershipId,
        clinicId: clinic.id,
        isActive: true,
        appointmentSettingsJson: null,
      },
      {
        id: otherMembershipId,
        clinicId: clinic.id,
        isActive: true,
        appointmentSettingsJson: null,
      },
    ],
  ) {
    const clinicValue = structuredClone(value);
    const membershipValues = structuredClone(memberships);
    const clinicRepository = {
      findOne: jest.fn().mockResolvedValue(clinicValue),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    const clinicMembershipRepository = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(
          membershipValues.find(
            (membership) =>
              membership.id === where.id &&
              membership.clinicId === where.clinicId &&
              membership.isActive === where.isActive,
          ) ?? null,
        ),
      ),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    return {
      clinicRepository,
      clinicMembershipRepository,
      service: new ClinicsService(
        clinicRepository as never,
        clinicMembershipRepository as never,
        {} as never,
        {} as never,
      ),
    };
  }

  it('normalizes legacy working hours into appointment settings', async () => {
    const { service } = serviceWithClinic();

    const settings = await service.getAppointmentSettings(clinic.id, clinic.id);

    expect(settings.availability.weekly?.[0]).toEqual({
      dayOfWeek: 1,
      isOpen: true,
      startTime: '08:30',
      endTime: '17:30',
    });
    expect(settings.availability.weekly?.[5]).toEqual({
      dayOfWeek: 6,
      isOpen: false,
    });
    expect(settings.scheduling.slotIntervalMin).toBe(15);
  });

  it('accepts closed weekend days and zero appointment buffer', async () => {
    const { service } = serviceWithClinic();

    const settings = await service.updateAppointmentSettings(
      clinic.id,
      clinic.id,
      {
        availability: {
          weekly: [
            { dayOfWeek: 6, isOpen: false },
            { dayOfWeek: 7, isOpen: false },
          ],
        },
        scheduling: { bufferBetweenAppointmentsMin: 0 },
      },
    );

    expect(settings.availability.weekly?.[5]).toEqual({
      dayOfWeek: 6,
      isOpen: false,
    });
    expect(settings.scheduling.bufferBetweenAppointmentsMin).toBe(0);
  });

  it('merges partial settings without clearing other sections', async () => {
    const { service, clinicRepository } = serviceWithClinic({
      ...clinic,
      workingHoursJson: {
        appointmentSettings: {
          scheduling: {
            defaultDurationMin: 45,
            slotIntervalMin: 20,
            bufferBetweenAppointmentsMin: 5,
          },
          reminders: {
            enabled: true,
            channels: [NotificationChannel.EMAIL],
            noticesBeforeMinutes: [60],
          },
        },
      },
    });

    const saved = await service.updateAppointmentSettings(
      clinic.id,
      clinic.id,
      {
        scheduling: { bufferBetweenAppointmentsMin: 10 },
        reminders: { noticesBeforeMinutes: [120, 1440] },
      },
    );

    expect(saved.scheduling).toEqual({
      defaultDurationMin: 45,
      slotIntervalMin: 20,
      bufferBetweenAppointmentsMin: 10,
    });
    expect(saved.reminders.noticesBeforeMinutes).toEqual([1440, 120]);
    expect(clinicRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects inconsistent time and confirmation windows', async () => {
    const { service } = serviceWithClinic();

    await expect(
      service.updateAppointmentSettings(clinic.id, clinic.id, {
        availability: {
          weekly: [
            {
              dayOfWeek: 1,
              isOpen: true,
              startTime: '18:00',
              endTime: '09:00',
            },
          ],
        },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.updateAppointmentSettings(clinic.id, clinic.id, {
        confirmation: {
          requestBeforeMinutes: 120,
          responseDeadlineBeforeMinutes: 1440,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicated weekly days and special dates', async () => {
    const { service } = serviceWithClinic();

    await expect(
      service.updateAppointmentSettings(clinic.id, clinic.id, {
        availability: {
          weekly: [
            { dayOfWeek: 1, isOpen: false },
            { dayOfWeek: 1, isOpen: true, startTime: '09:00', endTime: '12:00' },
          ],
        },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.updateAppointmentSettings(clinic.id, clinic.id, {
        availability: {
          specialDates: [
            { date: '2026-12-25', isClosed: true },
            { date: '2026-12-25', isClosed: true },
          ],
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns inherited clinic settings for professionals without overrides', async () => {
    const { service } = serviceWithClinic();

    const response = await service.getProfessionalAppointmentSettings(
      {
        clinicId: clinic.id,
        membershipId: professionalMembershipId,
        role: ClinicMembershipRole.odontologist,
        permissionsJson: {},
      },
      clinic.id,
      professionalMembershipId,
    );

    expect(response.inheritedFromClinic).toBe(true);
    expect(response.overrides).toEqual({});
    expect(response.settings.availability.weekly?.[0]).toEqual({
      dayOfWeek: 1,
      isOpen: true,
      startTime: '08:30',
      endTime: '17:30',
    });
  });

  it('stores professional overrides while keeping omitted values inherited', async () => {
    const { service, clinicMembershipRepository } = serviceWithClinic();

    const response = await service.updateProfessionalAppointmentSettings(
      {
        clinicId: clinic.id,
        membershipId: professionalMembershipId,
        role: ClinicMembershipRole.odontologist,
        permissionsJson: {},
      },
      clinic.id,
      professionalMembershipId,
      {
        availability: {
          weekly: [
            {
              dayOfWeek: 6,
              isOpen: true,
              startTime: '10:00',
              endTime: '14:00',
            },
          ],
        },
        scheduling: { bufferBetweenAppointmentsMin: 0 },
      },
    );

    expect(response.inheritedFromClinic).toBe(false);
    expect(response.settings.availability.weekly?.[0]).toEqual({
      dayOfWeek: 1,
      isOpen: true,
      startTime: '08:30',
      endTime: '17:30',
    });
    expect(response.settings.availability.weekly?.[5]).toEqual({
      dayOfWeek: 6,
      isOpen: true,
      startTime: '10:00',
      endTime: '14:00',
    });
    expect(response.settings.scheduling.bufferBetweenAppointmentsMin).toBe(0);
    expect(clinicMembershipRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentSettingsJson: expect.objectContaining({
          scheduling: { bufferBetweenAppointmentsMin: 0 },
        }),
      }),
    );
  });

  it('allows schedule managers to edit another professional settings', async () => {
    const { service } = serviceWithClinic();

    const response = await service.updateProfessionalAppointmentSettings(
      {
        clinicId: clinic.id,
        membershipId: otherMembershipId,
        role: ClinicMembershipRole.receptionist,
        permissionsJson: { canManageSchedule: true },
      },
      clinic.id,
      professionalMembershipId,
      { scheduling: { defaultDurationMin: 45 } },
    );

    expect(response.settings.scheduling.defaultDurationMin).toBe(45);
  });

  it('rejects editing another professional without schedule permission', async () => {
    const { service } = serviceWithClinic();

    await expect(
      service.updateProfessionalAppointmentSettings(
        {
          clinicId: clinic.id,
          membershipId: otherMembershipId,
          role: ClinicMembershipRole.odontologist,
          permissionsJson: {},
        },
        clinic.id,
        professionalMembershipId,
        { scheduling: { defaultDurationMin: 45 } },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
