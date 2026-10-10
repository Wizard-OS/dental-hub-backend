import { apiMessage } from '../../common/i18n/api-message';
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

import { ClinicMembership } from '../../clinic-memberships/entities/clinic-membership.entity';
import type { AuthenticatedRequest } from '../interfaces';

@Injectable()
export class ClinicScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;

    if (!user) {
      throw new UnauthorizedException(
        apiMessage('api.messages.authenticated_user_not_found'),
      );
    }

    const clinicId = req.headers['x-clinic-id'];

    if (!clinicId || Array.isArray(clinicId) || !isUUID(clinicId)) {
      throw new BadRequestException(
        apiMessage(
          'api.messages.x_clinic_id_header_with_valid_uuid_is_required',
        ),
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
        apiMessage(
          'api.messages.user_does_not_have_active_membership_for_the_requested_clinic',
        ),
      );
    }

    req.clinicId = clinicId;
    req.clinicMembershipId = membership.id;
    req.clinicMembershipRole = membership.role;
    req.clinicPermissions = membership.permissionsJson ?? {};

    return true;
  }
}
