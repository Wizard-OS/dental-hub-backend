import { apiMessage } from '../../common/i18n/api-message';
import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { META_CLINIC_ROLES } from '../decorators/clinic-roles.decorator';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import type { AuthenticatedRequest } from '../interfaces';

@Injectable()
export class ClinicRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<ClinicMembershipRole[]>(
      META_CLINIC_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = req.clinicMembershipRole;

    if (role && roles.includes(role)) return true;

    throw new ForbiddenException(
      apiMessage('api.messages.clinic_membership_role_must_be_one_of', {
        roles: roles.join(', '),
      }),
    );
  }
}
