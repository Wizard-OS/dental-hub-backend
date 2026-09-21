import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateProfessionalSpecialtyDto } from './dto/create-professional-specialty.dto';
import { UpdateProfessionalSpecialtyDto } from './dto/update-professional-specialty.dto';
import { ProfessionalSpecialty } from './entities/professional-specialty.entity';

@Injectable()
export class ProfessionalSpecialtiesService {
  constructor(
    @InjectRepository(ProfessionalSpecialty)
    private readonly specialtyRepository: Repository<ProfessionalSpecialty>,
  ) {}

  findAll(includeInactive = false) {
    return this.specialtyRepository.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateProfessionalSpecialtyDto) {
    const name = dto.name.trim();
    const code = this.normalizeCode(dto.code ?? name);

    const existing = await this.specialtyRepository.findOne({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException('Professional specialty already exists');
    }

    const specialty = this.specialtyRepository.create({
      name,
      code,
      isActive: dto.isActive ?? true,
    });

    return this.specialtyRepository.save(specialty);
  }

  async update(id: string, dto: UpdateProfessionalSpecialtyDto) {
    const specialty = await this.findOne(id);
    if (dto.name !== undefined) specialty.name = dto.name.trim();
    if (dto.code !== undefined) specialty.code = this.normalizeCode(dto.code);
    if (dto.isActive !== undefined) specialty.isActive = dto.isActive;
    return this.specialtyRepository.save(specialty);
  }

  async remove(id: string) {
    const specialty = await this.findOne(id);
    specialty.isActive = false;
    return this.specialtyRepository.save(specialty);
  }

  async assertActive(id: string) {
    const specialty = await this.specialtyRepository.findOne({
      where: { id, isActive: true },
    });
    if (!specialty) {
      throw new BadRequestException('Professional specialty is not valid');
    }
    return specialty;
  }

  private async findOne(id: string) {
    const specialty = await this.specialtyRepository.findOne({ where: { id } });
    if (!specialty) {
      throw new NotFoundException('Professional specialty not found');
    }
    return specialty;
  }

  private normalizeCode(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
