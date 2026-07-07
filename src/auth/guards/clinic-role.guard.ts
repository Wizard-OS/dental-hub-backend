import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { META_CLINIC_ROLES } from '../decorators/clinic-roles.decorator';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';

@Injectable()
export class ClinicRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<ClinicMembershipRole[]>(
      META_CLINIC_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req.clinicMembershipRole as ClinicMembershipRole | undefined;

    if (role && roles.includes(role)) return true;

    throw new ForbiddenException(
      `Clinic membership role must be one of: [${roles.join(', ')}]`,
    );
  }
}
