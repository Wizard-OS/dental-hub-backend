import type { Request } from 'express';

import type { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import type { User } from '../entities/user.entity';

export interface AuthenticatedRequest extends Request {
  user?: User;
  clinicId?: string;
  clinicMembershipId?: string;
  clinicMembershipRole?: ClinicMembershipRole;
  clinicPermissions?: Record<string, boolean>;
}
