import { BadRequestException } from '@nestjs/common';

import { ClinicsService } from './clinics.service';
import { NotificationChannel } from '../common/interfaces/notification-channel.enum';

describe('ClinicsService appointment settings', () => {
  const clinic = {
    id: '69d0cbe5-f7e6-4928-99a9-cdf15c986b4f',
    isActive: true,
    workingHoursJson: {
      monday: [{ from: '08:30', to: '17:30' }],
      friday: [{ from: '09:00', to: '16:00' }],
    },
  };

  function serviceWithClinic(value = clinic) {
    const clinicRepository = {
      findOne: jest.fn().mockResolvedValue(value),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    return {
      clinicRepository,
      service: new ClinicsService(
        clinicRepository as never,
        {} as never,
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
});
