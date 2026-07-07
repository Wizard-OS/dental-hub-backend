import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { isUUID } from 'class-validator';

import { Patient } from './entities/patient.entity';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async create(clinicId: string, createPatientDto: CreatePatientDto) {
    if (createPatientDto.clinicId && clinicId !== createPatientDto.clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    try {
      const patient = this.patientRepository.create({
        ...createPatientDto,
        clinicId,
      });
      return await this.patientRepository.save(patient);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll(clinicId: string, paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;

    return await this.patientRepository.find({
      where: { clinicId },
      skip: offset,
      take: limit,
    });
  }

  async findOne(clinicId: string, term: string) {
    let patient: Patient | null;

    if (isUUID(term)) {
      patient = await this.patientRepository.findOne({
        where: { id: term, clinicId },
      });
    } else {
      const queryBuilder = this.patientRepository.createQueryBuilder('patient');

      patient = await queryBuilder
        .where('patient.clinicId = :clinicId', { clinicId })
        .andWhere(
          new Brackets((qb) => {
            qb.where('patient.email = :email', { email: term })
              .orWhere('patient.firstName = :firstName', { firstName: term })
              .orWhere('patient.lastName = :lastName', { lastName: term });
          }),
        )
        .getOne();
    }

    if (!patient)
      throw new NotFoundException(
        `Patient with id, email, firstName or lastName "${term}" not found`,
      );

    return patient;
  }

  async findOnePlain(clinicId: string, term: string) {
    return await this.findOne(clinicId, term);
  }

  async update(
    clinicId: string,
    id: string,
    updatePatientDto: UpdatePatientDto,
  ) {
    const patient = await this.findOne(clinicId, id);

    if (updatePatientDto.clinicId && updatePatientDto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    try {
      Object.assign(patient, updatePatientDto);
      return await this.patientRepository.save(patient);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(clinicId: string, id: string) {
    const patient = await this.findOne(clinicId, id);
    return await this.patientRepository.remove(patient);
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException((error as Record<string, unknown>).detail);
    }

    console.log(error);

    throw new InternalServerErrorException('Please check server logs');
  }
}
