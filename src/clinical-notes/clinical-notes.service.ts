import { QueryClinicalNotesDto } from './dto/query-clinical-notes.dto';
import { PatientFileStorageStatus } from '../patient-files/interfaces/patient-file-storage-status.enum';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { ClinicalNote } from './entities/clinical-note.entity';
import { ClinicalRecord } from '../clinical-records/entities/clinical-record.entity';
import { CreateClinicalNoteDto } from './dto/create-clinical-note.dto';
import { UpdateClinicalNoteDto } from './dto/update-clinical-note.dto';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';

@Injectable()
export class ClinicalNotesService {
  constructor(
    @InjectRepository(ClinicalNote)
    private readonly clinicalNoteRepository: Repository<ClinicalNote>,

    @InjectRepository(ClinicalRecord)
    private readonly clinicalRecordRepository: Repository<ClinicalRecord>,

    private readonly patientAccessService: PatientAccessService,
  ) {}

  async create(
    context: ClinicAccessContext,
    authorId: string,
    authorMembershipId: string,
    dto: CreateClinicalNoteDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    const record = await this.assertRecordInClinic(
      dto.clinicalRecordId,
      context.clinicId,
    );
    await this.patientAccessService.assertPatientAccessible(
      context,
      record.patientId,
    );

    const note = this.clinicalNoteRepository.create({
      ...dto,
      authorId,
      authorMembershipId,
    });

    return await this.clinicalNoteRepository.save(note);
  }

  async findAll(context: ClinicAccessContext) {
    const notes = await this.clinicalNoteRepository
      .createQueryBuilder('note')
      .innerJoinAndSelect('note.clinicalRecord', 'record')
      .innerJoinAndSelect('record.patient', 'patient')
      .leftJoinAndSelect('note.author', 'author')
      .where('patient.clinicId = :clinicId', { clinicId: context.clinicId })
      .orderBy('note.createdAt', 'DESC')
      .getMany();

    const allowed: ClinicalNote[] = [];
    for (const note of notes) {
      try {
        await this.patientAccessService.assertPatientAccessible(
          context,
          note.clinicalRecord.patientId,
        );
        this.patientAccessService.sanitizePatient(
          note.clinicalRecord.patient,
          context,
        );
        allowed.push(note);
      } catch {
        // Filter inaccessible patients out of collection results.
      }
    }
    return allowed;
  }

  async findByPatient(
    context: ClinicAccessContext,
    patientId: string,
    dto: QueryClinicalNotesDto,
  ) {
    await this.patientAccessService.assertPatientAccessible(context, patientId);
    if (dto.from && dto.to && new Date(dto.from) > new Date(dto.to))
      throw new BadRequestException('from must be before to');
    const query = this.clinicalNoteRepository
      .createQueryBuilder('note')
      .innerJoin('note.clinicalRecord', 'record')
      .leftJoin('note.author', 'author')
      .addSelect(['author.id', 'author.firstName', 'author.lastName'])
      .leftJoinAndSelect(
        'note.files',
        'file',
        'file.storageStatus = :available',
        { available: PatientFileStorageStatus.AVAILABLE },
      )
      .leftJoinAndSelect('note.exams', 'exam')
      .leftJoinAndSelect(
        'exam.files',
        'examFile',
        'examFile.storageStatus = :available',
      )
      .where('record.patientId = :patientId', { patientId });
    if (dto.authorMembershipId)
      query.andWhere('note.authorMembershipId = :authorId', {
        authorId: dto.authorMembershipId,
      });
    if (dto.clinicalNoteId)
      query.andWhere('note.id = :noteId', { noteId: dto.clinicalNoteId });
    if (dto.from)
      query.andWhere('note.occurredAt >= :from', { from: dto.from });
    if (dto.to) query.andWhere('note.occurredAt <= :to', { to: dto.to });
    if (dto.search)
      query.andWhere(
        '(note.title ILIKE :search OR note.content ILIKE :search OR note.reason ILIKE :search)',
        { search: `%${dto.search}%` },
      );
    const [items, total] = await query
      .orderBy('note.occurredAt', 'DESC')
      .addOrderBy('note.id', 'DESC')
      .skip(dto.offset)
      .take(dto.limit)
      .getManyAndCount();
    return { items, total, limit: dto.limit, offset: dto.offset };
  }

  async findOne(context: ClinicAccessContext, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinical note id');
    }

    const note = await this.clinicalNoteRepository
      .createQueryBuilder('note')
      .innerJoinAndSelect('note.clinicalRecord', 'record')
      .innerJoinAndSelect('record.patient', 'patient')
      .leftJoinAndSelect('note.author', 'author')
      .where('note.id = :id', { id })
      .andWhere('patient.clinicId = :clinicId', {
        clinicId: context.clinicId,
      })
      .getOne();

    if (!note) {
      throw new NotFoundException(`Clinical note with id ${id} not found`);
    }

    await this.patientAccessService.assertPatientAccessible(
      context,
      note.clinicalRecord.patientId,
    );
    this.patientAccessService.sanitizePatient(
      note.clinicalRecord.patient,
      context,
    );

    return note;
  }

  async update(
    context: ClinicAccessContext,
    id: string,
    dto: UpdateClinicalNoteDto,
  ) {
    this.patientAccessService.assertCanManageClinical(context);
    const note = await this.findOne(context, id);

    if (
      dto.clinicalRecordId &&
      dto.clinicalRecordId !== note.clinicalRecordId
    ) {
      throw new BadRequestException(
        'Cannot move a clinical note to another record',
      );
    }

    Object.assign(note, dto);
    return await this.clinicalNoteRepository.save(note);
  }

  async remove(context: ClinicAccessContext, id: string) {
    this.patientAccessService.assertCanManageClinical(context);
    const note = await this.findOne(context, id);
    await this.clinicalNoteRepository.remove(note);
    return { message: `Clinical note ${id} removed` };
  }

  private async assertRecordInClinic(
    clinicalRecordId: string,
    clinicId: string,
  ): Promise<ClinicalRecord> {
    const record = await this.clinicalRecordRepository
      .createQueryBuilder('record')
      .innerJoin('record.patient', 'patient')
      .where('record.id = :clinicalRecordId', { clinicalRecordId })
      .andWhere('patient.clinicId = :clinicId', { clinicId })
      .getOne();

    if (!record) {
      throw new BadRequestException(
        'Clinical record does not belong to the requested clinic',
      );
    }

    return record;
  }
}
