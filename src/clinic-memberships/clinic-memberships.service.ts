import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { ClinicMembership } from './entities/clinic-membership.entity';
import { CreateClinicMembershipDto } from './dto/create-clinic-membership.dto';
import { UpdateClinicMembershipDto } from './dto/update-clinic-membership.dto';
import { ClinicMembershipRole } from './interfaces/clinic-membership-role.enum';

@Injectable()
export class ClinicMembershipsService {
  constructor(
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  async create(
    clinicId: string,
    createClinicMembershipDto: CreateClinicMembershipDto,
  ) {
    this.ensureClinicScope(clinicId, createClinicMembershipDto.clinicId);

    try {
      const membership = this.clinicMembershipRepository.create(
        createClinicMembershipDto,
      );
      return await this.clinicMembershipRepository.save(membership);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAll(clinicId: string) {
    if (!isUUID(clinicId)) {
      throw new BadRequestException('Invalid clinic id');
    }

    return await this.clinicMembershipRepository.find({
      where: { clinicId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid membership id');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { id, clinicId },
      relations: { user: true },
    });

    if (!membership) {
      throw new NotFoundException(`Membership with id ${id} not found`);
    }

    return membership;
  }

  async update(
    clinicId: string,
    id: string,
    updateClinicMembershipDto: UpdateClinicMembershipDto,
  ) {
    const membership = await this.findOne(clinicId, id);

    if (updateClinicMembershipDto.clinicId) {
      this.ensureClinicScope(clinicId, updateClinicMembershipDto.clinicId);
    }

    if (
      updateClinicMembershipDto.userId &&
      updateClinicMembershipDto.userId !== membership.userId
    ) {
      throw new BadRequestException('Membership user cannot be changed');
    }

    if (
      membership.role === ClinicMembershipRole.owner &&
      updateClinicMembershipDto.role &&
      updateClinicMembershipDto.role !== ClinicMembershipRole.owner
    ) {
      await this.assertAnotherActiveOwnerExists(clinicId, id);
    }

    Object.assign(membership, updateClinicMembershipDto);

    try {
      return await this.clinicMembershipRepository.save(membership);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async remove(clinicId: string, id: string) {
    const membership = await this.findOne(clinicId, id);

    if (membership.role === ClinicMembershipRole.owner) {
      await this.assertAnotherActiveOwnerExists(clinicId, id);
    }

    membership.isActive = false;
    return await this.clinicMembershipRepository.save(membership);
  }

  private ensureClinicScope(scopedClinicId: string, bodyClinicId: string) {
    if (scopedClinicId !== bodyClinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }
  }

  private async assertAnotherActiveOwnerExists(
    clinicId: string,
    membershipId: string,
  ) {
    const ownerCount = await this.clinicMembershipRepository
      .createQueryBuilder('membership')
      .where('membership.clinicId = :clinicId', { clinicId })
      .andWhere('membership.id != :membershipId', { membershipId })
      .andWhere('membership.role = :role', { role: ClinicMembershipRole.owner })
      .andWhere('membership.isActive = true')
      .getCount();

    if (ownerCount === 0) {
      throw new BadRequestException(
        'Clinic must keep at least one active owner',
      );
    }
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException((error as Record<string, unknown>).detail);
    }

    throw new InternalServerErrorException('Please check server logs');
  }
}
