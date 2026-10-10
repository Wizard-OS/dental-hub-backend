import { apiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';

import { Patient } from '../patients/entities/patient.entity';
import { Treatment } from '../treatments/entities/treatment.entity';
import { ClinicalNote } from '../clinical-notes/entities/clinical-note.entity';
import { PatientFileType } from '../patient-files/interfaces/patient-file-type.enum';
import { PatientFilesService } from '../patient-files/patient-files.service';
import { OdontogramEntry } from './entities/odontogram-entry.entity';
import { UpdateOdontogramToothDto } from './dto/update-odontogram-tooth.dto';
import { GenerateOdontogramPdfDto } from './dto/generate-odontogram-pdf.dto';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';
import { ToothStatus } from './interfaces/tooth-status.enum';
import { ToothSurface } from './interfaces/tooth-surface.enum';
import { OdontogramPdfService } from './odontogram-pdf.service';

const ADULT_TOOTH_CODES = [
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
];

const ADULT_TOOTH_CODE_SET = new Set(ADULT_TOOTH_CODES);

const ADULT_TOOTH_ROWS = [
  ['18', '17', '16', '15', '14', '13', '12', '11'],
  ['21', '22', '23', '24', '25', '26', '27', '28'],
  ['48', '47', '46', '45', '44', '43', '42', '41'],
  ['31', '32', '33', '34', '35', '36', '37', '38'],
];

const ODONTOGRAM_LEGEND = [
  {
    status: ToothStatus.HEALTHY,
    label: 'Sano',
    abbreviation: 'S',
    colorHex: '#E5E7EB',
  },
  {
    status: ToothStatus.CARIES,
    label: 'Caries',
    abbreviation: 'CA',
    colorHex: '#F87171',
  },
  {
    status: ToothStatus.MISSING,
    label: 'Ausente',
    abbreviation: 'AU',
    colorHex: '#9CA3AF',
  },
  {
    status: ToothStatus.RESTORED,
    label: 'Restaurado',
    abbreviation: 'R',
    colorHex: '#60A5FA',
  },
  {
    status: ToothStatus.ENDODONTICS,
    label: 'Endodoncia',
    abbreviation: 'EN',
    colorHex: '#A78BFA',
  },
  {
    status: ToothStatus.CROWN,
    label: 'Corona',
    abbreviation: 'CO',
    colorHex: '#FBBF24',
  },
  {
    status: ToothStatus.IMPLANT,
    label: 'Implante',
    abbreviation: 'IM',
    colorHex: '#34D399',
  },
  {
    status: ToothStatus.EXTRACTION_INDICATED,
    label: 'Extraccion indicada',
    abbreviation: 'EX',
    colorHex: '#DC2626',
  },
  {
    status: ToothStatus.OBSERVATION,
    label: 'Observacion',
    abbreviation: 'OB',
    colorHex: '#FB923C',
  },
];

@Injectable()
export class OdontogramService {
  constructor(
    @InjectRepository(OdontogramEntry)
    private readonly odontogramRepository: Repository<OdontogramEntry>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(ClinicalNote)
    private readonly clinicalNoteRepository: Repository<ClinicalNote>,

    @InjectRepository(Treatment)
    private readonly treatmentRepository: Repository<Treatment>,

    private readonly patientAccessService: PatientAccessService,
    private readonly patientFilesService: PatientFilesService,
    private readonly odontogramPdfService: OdontogramPdfService,
  ) {}

  async findByPatient(context: ClinicAccessContext, patientId: string) {
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const patient = await this.findPatientForResponse(context, patientId);
    const entries = await this.findEntriesByPatient(patientId);

    return {
      patient,
      dentition: {
        type: 'adult',
        notation: 'FDI',
        toothCodes: ADULT_TOOTH_CODES,
        rows: ADULT_TOOTH_ROWS,
        surfaces: Object.values(ToothSurface),
        mesialDistalRule:
          'Mesial y distal se guardan como superficies clinicas canonicas; la orientacion visual depende del cuadrante frente a la linea media.',
      },
      legend: ODONTOGRAM_LEGEND,
      teeth: ADULT_TOOTH_CODES.map((toothCode) => ({
        toothCode,
        entries: entries.filter((entry) => entry.toothCode === toothCode),
      })),
      entries,
    };
  }

  async updateTooth(
    context: ClinicAccessContext,
    patientId: string,
    toothCode: string,
    professionalMembershipId: string,
    dto: UpdateOdontogramToothDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    this.assertAdultToothCode(toothCode);
    await this.patientAccessService.assertPatientAccessible(context, patientId);

    if (dto.clinicalNoteId) {
      await this.assertClinicalNoteForPatient(
        dto.clinicalNoteId,
        patientId,
        context.clinicId,
      );
    }

    if (dto.treatmentId) {
      await this.assertTreatmentForPatient(
        dto.treatmentId,
        patientId,
        context.clinicId,
      );
    }

    const surfaces = this.resolveSurfaces(dto.surfaces);
    const actionGroupId = randomUUID();
    const entries = await Promise.all(
      surfaces.map(async (surface) => {
        let entry = await this.odontogramRepository.findOne({
          where: { patientId, toothCode, surface },
        });

        if (!entry) {
          entry = this.odontogramRepository.create({
            patientId,
            toothCode,
            surface,
          });
        }

        Object.assign(entry, {
          status: dto.status,
          actionGroupId,
          treatmentType: dto.treatmentType ?? null,
          description: dto.description ?? null,
          observation: dto.observation ?? null,
          clinicalNoteId: dto.clinicalNoteId ?? null,
          treatmentId: dto.treatmentId ?? null,
          professionalMembershipId,
        });

        return entry;
      }),
    );

    const savedEntries = await this.odontogramRepository.save(entries);

    return {
      actionGroupId,
      entries: savedEntries,
    };
  }

  async removeEntry(
    context: ClinicAccessContext,
    patientId: string,
    entryId: string,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(context, patientId);

    const entry = await this.odontogramRepository.findOne({
      where: { id: entryId, patientId },
    });

    if (!entry) {
      throw new NotFoundException(
        apiMessage('api.messages.odontogram_entry_not_found', {
          entryId: entryId,
        }),
      );
    }

    await this.odontogramRepository.remove(entry);
    return {
      message: apiMessage('api.messages.odontogram_entry_deleted', {
        entryId: entryId,
      }),
    };
  }

  async generatePdf(
    context: ClinicAccessContext,
    patientId: string,
    professionalMembershipId: string,
    baseUrl: string,
    dto: GenerateOdontogramPdfDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    const patient = await this.findPatientInClinic(patientId, context.clinicId);
    const entries = await this.findEntriesByPatient(patientId);
    const generatedAt = new Date();
    const pdf = this.odontogramPdfService.generate({
      patient,
      entries,
      generatedAt,
    });
    const uploadDir = path.join(process.cwd(), 'uploads', 'patient-files');
    await fs.mkdir(uploadDir, { recursive: true });

    const safeDate = generatedAt.toISOString().slice(0, 10);
    const originalName = `odontograma-${patient.firstName}-${patient.lastName}-${safeDate}.pdf`;
    const filename = `${Date.now()}-${randomUUID()}-odontogram.pdf`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, pdf);

    return await this.patientFilesService.createGenerated(
      context,
      patientId,
      professionalMembershipId,
      baseUrl,
      {
        originalName,
        path: filePath,
        mimeType: 'application/pdf',
        size: pdf.length,
        type: PatientFileType.PDF,
        description: dto.description ?? 'Reporte PDF de odontograma',
        appointmentId: dto.appointmentId ?? null,
        clinicalNoteId: dto.clinicalNoteId ?? null,
        treatmentId: dto.treatmentId ?? null,
      },
    );
  }

  private resolveSurfaces(surfaces?: ToothSurface[]): ToothSurface[] {
    const resolved = surfaces?.length ? surfaces : [ToothSurface.FULL];
    const unique = new Set(resolved);

    if (unique.size !== resolved.length) {
      throw new BadRequestException(
        apiMessage('api.messages.duplicate_tooth_surfaces_are_not_allowed'),
      );
    }

    if (unique.has(ToothSurface.FULL) && unique.size > 1) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.full_tooth_surface_cannot_be_combined_with_partial_surfaces',
        ),
      );
    }

    return resolved;
  }

  private assertAdultToothCode(toothCode: string) {
    if (!ADULT_TOOTH_CODE_SET.has(toothCode)) {
      throw new BadRequestException(
        apiMessage('api.messages.invalid_adult_tooth_code'),
      );
    }
  }

  private async findPatientForResponse(
    context: ClinicAccessContext,
    patientId: string,
  ) {
    const patient = await this.findPatientInClinic(patientId, context.clinicId);
    return this.patientAccessService.sanitizePatient(patient, context);
  }

  private async findPatientInClinic(
    patientId: string,
    clinicId: string,
  ): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, clinicId },
    });

    if (!patient) {
      throw new NotFoundException(
        apiMessage('api.messages.patient_by_id_does_not_belong_to_clinic', {
          patientId: patientId,
        }),
      );
    }

    return patient;
  }

  private async findEntriesByPatient(patientId: string) {
    return await this.odontogramRepository.find({
      where: { patientId },
      order: { toothCode: 'ASC', surface: 'ASC', updatedAt: 'DESC' },
    });
  }

  private async assertClinicalNoteForPatient(
    clinicalNoteId: string,
    patientId: string,
    clinicId: string,
  ) {
    const note = await this.clinicalNoteRepository
      .createQueryBuilder('note')
      .innerJoin('note.clinicalRecord', 'record')
      .innerJoin('record.patient', 'patient')
      .where('note.id = :clinicalNoteId', { clinicalNoteId })
      .andWhere('record.patientId = :patientId', { patientId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!note) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.clinical_note_does_not_belong_to_patient_and_clinic_scope',
        ),
      );
    }
  }

  private async assertTreatmentForPatient(
    treatmentId: string,
    patientId: string,
    clinicId: string,
  ) {
    const treatment = await this.treatmentRepository
      .createQueryBuilder('treatment')
      .innerJoin('treatment.patient', 'patient')
      .where('treatment.id = :treatmentId', { treatmentId })
      .andWhere('treatment.patientId = :patientId', { patientId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!treatment) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.treatment_does_not_belong_to_patient_and_clinic_scope',
        ),
      );
    }
  }
}
