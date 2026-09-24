import { BadRequestException } from '@nestjs/common';

import { AppointmentsService } from './appointments.service';
import { AppointmentAvailabilityService } from '../clinics/appointment-availability.service';
import { AppointmentStatus } from './interfaces/AppointmentStatus.enum';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';

describe('AppointmentsService availability validation', () => {
  const clinicId = '69d0cbe5-f7e6-4928-99a9-cdf15c986b4f';
  const patientId = 'bb8ee7c7-2193-4d25-a602-19904db1fef0';
  const membershipId = '9e9b76d6-d03a-4abf-a607-f46ffbc70148';
  const dentistId = '12377e61-503b-4adb-9190-fad4288bdf64';
  const context = {
    clinicId,
    membershipId,
    role: ClinicMembershipRole.admin,
    permissionsJson: {},
  };

  function serviceWithAvailability(workingHoursJson: Record<string, unknown>) {
    const overlapQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const appointmentRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(overlapQuery),
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) =>
        Promise.resolve({
          id: 'appointment-id',
          ...entity,
        }),
      ),
    };
    const patientRepository = {
      findOne: jest.fn().mockResolvedValue({ id: patientId }),
    };
    const clinicRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: clinicId,
        isActive: true,
        timezone: 'America/Montevideo',
        workingHoursJson,
      }),
    };
    const clinicMembershipRepository = {
      findOne: jest.fn(({ where }) => {
        if (
          where.id === membershipId ||
          (where.userId === dentistId && where.clinicId === clinicId)
        ) {
          return Promise.resolve({
            id: membershipId,
            clinicId,
            userId: dentistId,
            isActive: true,
            appointmentSettingsJson: null,
          });
        }
        return Promise.resolve(null);
      }),
    };
    const availabilityService = new AppointmentAvailabilityService(
      clinicRepository as never,
      clinicMembershipRepository as never,
    );
    const patientAccessService = {
      canManagePatients: jest.fn().mockReturnValue(true),
      canViewAllPatients: jest.fn().mockReturnValue(true),
    };
    const service = new AppointmentsService(
      appointmentRepository as never,
      {} as never,
      patientRepository as never,
      clinicMembershipRepository as never,
      patientAccessService as never,
      availabilityService,
    );

    return { service, appointmentRepository, overlapQuery };
  }

  function baseDto(startTime: string, endTime: string) {
    return {
      clinicId,
      patientId,
      professionalMembershipId: membershipId,
      description: 'Control',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    };
  }

  it('creates appointments inside professional working hours', async () => {
    const { service } = serviceWithAvailability({
      appointmentSettings: {
        availability: {
          weekly: [
            {
              dayOfWeek: 1,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
        },
      },
    });

    const appointment = await service.create(
      context,
      baseDto('2026-09-21T12:30:00.000Z', '2026-09-21T13:00:00.000Z'),
    );

    expect(appointment).toEqual(
      expect.objectContaining({
        clinicId,
        patientId,
        professionalMembershipId: membershipId,
        status: AppointmentStatus.SCHEDULED,
      }),
    );
  });

  it('rejects appointments outside working hours', async () => {
    const { service } = serviceWithAvailability({
      appointmentSettings: {
        availability: {
          weekly: [
            {
              dayOfWeek: 1,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
        },
      },
    });

    await expect(
      service.create(
        context,
        baseDto('2026-09-21T11:30:00.000Z', '2026-09-21T12:00:00.000Z'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects appointments that overlap breaks', async () => {
    const { service } = serviceWithAvailability({
      appointmentSettings: {
        availability: {
          weekly: [
            {
              dayOfWeek: 1,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
          breaks: [
            {
              name: 'Almuerzo',
              daysOfWeek: [1],
              startTime: '13:00',
              endTime: '14:00',
            },
          ],
        },
      },
    });

    await expect(
      service.create(
        context,
        baseDto('2026-09-21T16:30:00.000Z', '2026-09-21T17:00:00.000Z'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects closed special dates and allows custom open windows', async () => {
    const { service } = serviceWithAvailability({
      appointmentSettings: {
        availability: {
          weekly: [
            {
              dayOfWeek: 2,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
            {
              dayOfWeek: 3,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
          specialDates: [
            { date: '2026-09-22', isClosed: true },
            {
              date: '2026-09-23',
              isClosed: false,
              startTime: '10:00',
              endTime: '12:00',
            },
          ],
        },
      },
    });

    await expect(
      service.create(
        context,
        baseDto('2026-09-22T13:00:00.000Z', '2026-09-22T14:00:00.000Z'),
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create(
        context,
        baseDto('2026-09-23T13:30:00.000Z', '2026-09-23T14:00:00.000Z'),
      ),
    ).resolves.toEqual(
      expect.objectContaining({ professionalMembershipId: membershipId }),
    );
  });

  it('keeps existing overlap rejection', async () => {
    const { service, overlapQuery } = serviceWithAvailability({
      appointmentSettings: {
        availability: {
          weekly: [
            {
              dayOfWeek: 1,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
        },
      },
    });
    overlapQuery.getOne.mockResolvedValueOnce({ id: 'overlap' });

    await expect(
      service.create(
        context,
        baseDto('2026-09-21T12:30:00.000Z', '2026-09-21T13:00:00.000Z'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolves professional membership from dentistId when omitted', async () => {
    const { service } = serviceWithAvailability({
      appointmentSettings: {
        availability: {
          weekly: [
            {
              dayOfWeek: 1,
              isOpen: true,
              startTime: '09:00',
              endTime: '18:00',
            },
          ],
        },
      },
    });

    const appointment = await service.create(context, {
      ...baseDto('2026-09-21T12:30:00.000Z', '2026-09-21T13:00:00.000Z'),
      professionalMembershipId: undefined,
      dentistId,
    });

    expect(appointment).toEqual(
      expect.objectContaining({ professionalMembershipId: membershipId }),
    );
  });
});
