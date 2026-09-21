import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ProfessionalSpecialty } from './entities/professional-specialty.entity';
import { ProfessionalSpecialtiesService } from './professional-specialties.service';

describe('ProfessionalSpecialtiesService', () => {
  let service: ProfessionalSpecialtiesService;
  let records: ProfessionalSpecialty[];

  beforeEach(() => {
    records = [
      {
        id: 'specialty-1',
        code: 'ortodoncia',
        name: 'Ortodoncia',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        normalize: jest.fn(),
      },
      {
        id: 'specialty-2',
        code: 'endodoncia',
        name: 'Endodoncia',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        normalize: jest.fn(),
      },
    ];

    const repository = {
      find: jest.fn(({ where }: { where?: Partial<ProfessionalSpecialty> }) => {
        const filtered =
          where?.isActive === undefined
            ? records
            : records.filter((record) => record.isActive === where.isActive);
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      }),
      findOne: jest.fn(
        ({ where }: { where: Partial<ProfessionalSpecialty> }) =>
          records.find((record) =>
            Object.entries(where).every(
              ([key, value]) =>
                record[key as keyof ProfessionalSpecialty] === value,
            ),
          ) ?? null,
      ),
      create: jest.fn((data: Partial<ProfessionalSpecialty>) => ({
        id: 'specialty-created',
        createdAt: new Date(),
        updatedAt: new Date(),
        normalize: jest.fn(),
        ...data,
      })),
      save: jest.fn((record: ProfessionalSpecialty) => {
        const index = records.findIndex((item) => item.id === record.id);
        if (index >= 0) {
          records[index] = record;
        } else {
          records.push(record);
        }
        return record;
      }),
    };

    service = new ProfessionalSpecialtiesService(repository as never);
  });

  it('lists active specialties by default', async () => {
    expect(await service.findAll()).toEqual([
      expect.objectContaining({ code: 'ortodoncia' }),
    ]);
  });

  it('creates a normalized specialty code', async () => {
    await expect(
      service.create({ name: 'Cirugía oral' }),
    ).resolves.toMatchObject({
      code: 'cirugia_oral',
      name: 'Cirugía oral',
      isActive: true,
    });
  });

  it('soft-disables specialties', async () => {
    await expect(service.remove('specialty-1')).resolves.toMatchObject({
      id: 'specialty-1',
      isActive: false,
    });
  });

  it('rejects duplicate codes and missing records', async () => {
    await expect(service.create({ name: 'Ortodoncia' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
