import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PatientExam } from './entities/patient-exam.entity';
import { PatientFile } from '../patient-files/entities/patient-file.entity';
import { ClinicalNote } from '../clinical-notes/entities/clinical-note.entity';
import {
  ClinicAccessContext,
  PatientAccessService,
} from '../patients/services/patient-access.service';
import {
  CreatePatientExamDto,
  UpdatePatientExamDto,
} from './dto/create-patient-exam.dto';
import { QueryPatientExamsDto } from './dto/query-patient-exams.dto';
import { PatientFileStorageStatus } from '../patient-files/interfaces/patient-file-storage-status.enum';

@Injectable()
export class PatientExamsService {
  constructor(
    @InjectRepository(PatientExam)
    private readonly exams: Repository<PatientExam>,
    @InjectRepository(PatientFile)
    private readonly files: Repository<PatientFile>,
    @InjectRepository(ClinicalNote)
    private readonly notes: Repository<ClinicalNote>,
    private readonly access: PatientAccessService,
  ) {}

  async create(
    context: ClinicAccessContext,
    patientId: string,
    dto: CreatePatientExamDto,
  ) {
    this.access.assertCanManageClinical(context);
    await this.access.assertPatientAccessible(context, patientId);
    const { fileIds, ...fields } = dto;
    const files = await this.validateRelations(patientId, {
      ...fields,
      fileIds,
    });
    return this.exams.save(this.exams.create({ ...fields, patientId, files }));
  }

  async findAll(
    context: ClinicAccessContext,
    patientId: string,
    dto: QueryPatientExamsDto,
  ) {
    await this.access.assertPatientAccessible(context, patientId);
    if (dto.from && dto.to && new Date(dto.from) > new Date(dto.to)) {
      throw new BadRequestException('from must be before to');
    }
    const query = this.exams
      .createQueryBuilder('exam')
      .leftJoinAndSelect(
        'exam.files',
        'file',
        'file.storageStatus = :available',
        { available: PatientFileStorageStatus.AVAILABLE },
      )
      .where('exam.patientId = :patientId', { patientId });
    if (dto.category)
      query.andWhere('exam.category = :category', { category: dto.category });
    if (dto.clinicalNoteId)
      query.andWhere('exam.clinicalNoteId = :noteId', {
        noteId: dto.clinicalNoteId,
      });
    if (dto.from)
      query.andWhere('exam.performedAt >= :from', { from: dto.from });
    if (dto.to) query.andWhere('exam.performedAt <= :to', { to: dto.to });
    if (dto.search)
      query.andWhere('exam.title ILIKE :search', { search: `%${dto.search}%` });
    const [items, total] = await query
      .orderBy('exam.performedAt', 'DESC')
      .addOrderBy('exam.id', 'DESC')
      .skip(dto.offset)
      .take(dto.limit)
      .getManyAndCount();
    return { items, total, limit: dto.limit, offset: dto.offset };
  }

  async findOne(context: ClinicAccessContext, patientId: string, id: string) {
    await this.access.assertPatientAccessible(context, patientId);
    const exam = await this.exams.findOne({
      where: { id, patientId },
      relations: { files: true },
    });
    if (!exam) throw new NotFoundException('Patient exam not found');
    exam.files = exam.files.filter(
      (file) => file.storageStatus === PatientFileStorageStatus.AVAILABLE,
    );
    return exam;
  }

  async update(
    context: ClinicAccessContext,
    patientId: string,
    id: string,
    dto: UpdatePatientExamDto,
  ) {
    this.access.assertCanManageClinical(context);
    const exam = await this.findOne(context, patientId, id);
    const { fileIds, ...fields } = dto;
    const files = await this.validateRelations(patientId, dto);
    Object.assign(exam, fields);
    // Do not rewrite attachment relations when only changing metadata.
    if (fileIds !== undefined) exam.files = files;
    else delete (exam as Partial<PatientExam>).files;
    return this.exams.save(exam);
  }

  async remove(context: ClinicAccessContext, patientId: string, id: string) {
    this.access.assertCanManageClinical(context);
    const exam = await this.findOne(context, patientId, id);
    await this.exams.remove(exam);
    return { message: `Patient exam ${id} removed` };
  }

  private async validateRelations(
    patientId: string,
    dto: UpdatePatientExamDto,
  ) {
    if (dto.clinicalNoteId) {
      const note = await this.notes.findOne({
        where: { id: dto.clinicalNoteId, clinicalRecord: { patientId } },
      });
      if (!note)
        throw new BadRequestException(
          'Clinical note does not belong to patient',
        );
    }
    if (!dto.fileIds?.length) return [];
    const files = await this.files.find({
      where: {
        id: In(dto.fileIds),
        patientId,
        storageStatus: PatientFileStorageStatus.AVAILABLE,
      },
    });
    if (files.length !== dto.fileIds.length)
      throw new BadRequestException(
        'All files must be available and belong to patient',
      );
    return files;
  }
}
