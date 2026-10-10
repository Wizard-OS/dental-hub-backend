import { apiMessage } from '../common/i18n/api-message';
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
import { MembershipService } from '../membership/membership.service';

@Injectable()
export class ClinicMembershipsService {
  constructor(
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    private readonly membershipService: MembershipService,
  ) {}

  async create(
    clinicId: string,
    createClinicMembershipDto: CreateClinicMembershipDto,
  ) {
    this.ensureClinicScope(clinicId, createClinicMembershipDto.clinicId);

    await this.membershipService.assertCanCreateMembership(
      clinicId,
      createClinicMembershipDto.role,
    );

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
      throw new BadRequestException(
        apiMessage('api.messages.invalid_clinic_id'),
      );
    }

    return await this.clinicMembershipRepository.find({
      where: { clinicId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException(
        apiMessage('api.messages.invalid_membership_id'),
      );
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: { id, clinicId },
      relations: { user: true },
    });

    if (!membership) {
      throw new NotFoundException(
        apiMessage('api.messages.membership_with_id_not_found', { id: id }),
      );
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
      throw new BadRequestException(
        apiMessage('api.messages.membership_user_cannot_be_changed'),
      );
    }

    if (
      membership.role === ClinicMembershipRole.owner &&
      updateClinicMembershipDto.role &&
      updateClinicMembershipDto.role !== ClinicMembershipRole.owner
    ) {
      await this.assertAnotherActiveOwnerExists(clinicId, id);
    }

    if (
      updateClinicMembershipDto.isActive !== false &&
      updateClinicMembershipDto.role &&
      updateClinicMembershipDto.role !== membership.role
    ) {
      await this.assertRoleChangeWithinLimits(
        clinicId,
        membership,
        updateClinicMembershipDto.role,
      );
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
        apiMessage('api.messages.clinicid_does_not_match_x_clinic_id_scope'),
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
        apiMessage('api.messages.clinic_must_keep_at_least_one_active_owner'),
      );
    }
  }

  private async assertRoleChangeWithinLimits(
    clinicId: string,
    membership: ClinicMembership,
    nextRole: ClinicMembershipRole,
  ) {
    if (!membership.isActive) return;

    const currentlyProfessional = this.membershipService.isProfessionalRole(
      membership.role,
    );
    const nextProfessional =
      this.membershipService.isProfessionalRole(nextRole);

    if (!currentlyProfessional && nextProfessional) {
      await this.membershipService.assertCanAddProfessional(clinicId);
    }
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException(
        apiMessage('api.messages.duplicate_record'),
      );
    }

    throw new InternalServerErrorException(
      apiMessage('api.messages.please_check_server_logs'),
    );
  }
}
