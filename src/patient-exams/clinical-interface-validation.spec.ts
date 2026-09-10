import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAppointmentTypeDto } from '../appointments/dto/create-appointment-type.dto';
import { UpdateAppointmentTypeDto } from '../appointments/dto/update-appointment-type.dto';
import { CreateClinicalRecordDto } from '../clinical-records/dto/create-clinical-record.dto';
import {
  CreatePatientExamDto,
  UpdatePatientExamDto,
} from './dto/create-patient-exam.dto';
import { QueryPatientExamsDto } from './dto/query-patient-exams.dto';

describe('Clinical interface input validation', () => {
  it('accepts no-price types, free types, and custom HEX colors', async () => {
    for (const defaultPrice of [undefined, null, '0', '1200.00']) {
      expect(
        await validate(
          plainToInstance(CreateAppointmentTypeDto, {
            name: 'Ortodoncia',
            durationMin: 45,
            color: '#8B5CF6',
            defaultPrice,
          }),
        ),
      ).toEqual([]);
    }
  });

  it.each([
    { color: 'purple' },
    { color: null },
    { durationMin: 4 },
    { durationMin: null },
    { defaultPrice: '-1' },
    { defaultPrice: '10000000000' },
    { currency: 'pesos' },
    { name: '  ' },
  ])('rejects invalid appointment settings %p', async (fields) => {
    expect(
      (await validate(plainToInstance(UpdateAppointmentTypeDto, fields)))
        .length,
    ).toBeGreaterThan(0);
  });

  it('accepts clearing price without resetting other settings', async () => {
    expect(
      await validate(
        plainToInstance(UpdateAppointmentTypeDto, { defaultPrice: null }),
      ),
    ).toEqual([]);
  });

  it('validates blood type', async () => {
    const value = {
      patientId: 'ee53ef20-0e58-4cb1-a1eb-ffdbfaaf3812',
      bloodType: 'X+',
    };
    expect(
      (await validate(plainToInstance(CreateClinicalRecordDto, value))).length,
    ).toBeGreaterThan(0);
  });

  it('validates nested measurements and transforms exam dates', async () => {
    const fields = {
      title: 'Cefalometría',
      category: 'cephalometry',
      performedAt: '2026-09-02T10:00:00Z',
      measurements: [{ name: 'SNA', value: 82 }],
    };
    const valid = plainToInstance(CreatePatientExamDto, fields);
    expect(await validate(valid)).toEqual([]);
    expect(valid.performedAt).toBeInstanceOf(Date);
    expect(
      (
        await validate(
          plainToInstance(CreatePatientExamDto, {
            ...fields,
            measurements: [{ name: 'SNA', value: 'not numeric' }],
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    { fileIds: null },
    { measurements: null },
    { performedAt: null },
    { title: null },
    { category: 'invalid' },
  ])('rejects invalid exam patches %p', async (fields) => {
    expect(
      (await validate(plainToInstance(UpdatePatientExamDto, fields))).length,
    ).toBeGreaterThan(0);
  });

  it('bounds and validates pagination and category filters', async () => {
    expect(
      await validate(
        plainToInstance(QueryPatientExamsDto, {
          limit: '10',
          offset: '0',
          category: 'photography',
        }),
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(QueryPatientExamsDto, {
            limit: 1000,
            offset: -1,
            category: 'invalid',
          }),
        )
      ).length,
    ).toBe(3);
  });
});
