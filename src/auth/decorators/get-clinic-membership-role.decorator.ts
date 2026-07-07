import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';

export const GetClinicMembershipRole = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.clinicMembershipRole as ClinicMembershipRole | undefined;
  },
);
