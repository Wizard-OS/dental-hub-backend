import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { User } from '../entities/user.entity';
import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';

@Injectable()
export class ClinicScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as User | undefined;

    if (!user) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const clinicId = req.headers['x-clinic-id'];

    if (!clinicId || Array.isArray(clinicId) || !isUUID(clinicId)) {
      throw new BadRequestException(
        'x-clinic-id header with valid UUID is required',
      );
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: {
        clinicId,
        userId: user.id,
        isActive: true,
        clinic: { isActive: true },
      },
      relations: { clinic: true },
    });

    if (!membership) {
      throw new UnauthorizedException(
        'User does not have active membership for the requested clinic',
      );
    }

    req.clinicId = clinicId;
    req.clinicMembershipId = membership.id;
    req.clinicMembershipRole = membership.role;
    req.clinicPermissions = membership.permissionsJson ?? {};

    return true;
  }
}
