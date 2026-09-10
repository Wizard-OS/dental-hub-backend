import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PatientExamsService } from './patient-exams.service';
import {
  PatientExam,
  PatientExamCategory,
} from './entities/patient-exam.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { ClinicalNote } from '../clinical-notes/entities/clinical-note.entity';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';
import { QueryPatientExamsDto } from './dto/query-patient-exams.dto';

const context = {
  clinicId: 'clinic',
  membershipId: 'member',
} as ClinicAccessContext;
const dto = {
  title: 'Cefalometría',
  category: PatientExamCategory.CEPHALOMETRY,
  performedAt: new Date(),
  measurements: [{ name: 'SNA', value: 82 }],
};

describe('PatientExamsService', () => {
  const exams = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const files = { find: jest.fn() };
  const notes = { findOne: jest.fn() };
  const access = {
    assertCanManageClinical: jest.fn(),
    assertPatientAccessible: jest.fn(),
  };
  let service: PatientExamsService;
  beforeEach(() => {
    jest.clearAllMocks();
    access.assertCanManageClinical.mockImplementation(() => undefined);
    access.assertPatientAccessible.mockResolvedValue(undefined);
    service = new PatientExamsService(
      exams as unknown as Repository<PatientExam>,
      files as unknown as Repository<PatientFile>,
      notes as unknown as Repository<ClinicalNote>,
      access as unknown as PatientAccessService,
    );
  });

  it('stores measurements without requiring a file', async () => {
    const result = await service.create(context, 'patient', dto);
    expect(result).toMatchObject({
      patientId: 'patient',
      measurements: dto.measurements,
      files: [],
    });
    expect(access.assertPatientAccessible).toHaveBeenCalledWith(
      context,
      'patient',
    );
  });

  it('rejects attachments belonging to another patient or unavailable files', async () => {
    files.find.mockResolvedValue([]);
    await expect(
      service.create(context, 'patient', { ...dto, fileIds: ['foreign-file'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(exams.save).not.toHaveBeenCalled();
  });

  it('rejects a clinical note from another patient', async () => {
    notes.findOne.mockResolvedValue(null);
    await expect(
      service.create(context, 'patient', {
        ...dto,
        clinicalNoteId: 'foreign-note',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(exams.save).not.toHaveBeenCalled();
  });

  it('denies reads before querying exams when patient is inaccessible', async () => {
    access.assertPatientAccessible.mockRejectedValue(new ForbiddenException());
    await expect(
      service.findAll(context, 'foreign-patient', new QueryPatientExamsDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(exams.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('does not overwrite file associations during a metadata-only update', async () => {
    exams.findOne.mockResolvedValue({
      id: 'exam',
      patientId: 'patient',
      files: [],
    });
    await service.update(context, 'patient', 'exam', { title: 'Updated' });
    expect(exams.save).toHaveBeenCalledWith({
      id: 'exam',
      patientId: 'patient',
      title: 'Updated',
    });
  });

  it('allows clearing attachments explicitly', async () => {
    exams.findOne.mockResolvedValue({
      id: 'exam',
      patientId: 'patient',
      files: [],
    });
    await service.update(context, 'patient', 'exam', { fileIds: [] });
    expect(exams.save).toHaveBeenCalledWith({
      id: 'exam',
      patientId: 'patient',
      files: [],
    });
  });
});
