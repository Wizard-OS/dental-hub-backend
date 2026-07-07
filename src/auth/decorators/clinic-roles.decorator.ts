import { SetMetadata } from '@nestjs/common';

import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';

export const META_CLINIC_ROLES = 'clinicRoles';

export const ClinicRoles = (...roles: ClinicMembershipRole[]) => {
  return SetMetadata(META_CLINIC_ROLES, roles);
};
