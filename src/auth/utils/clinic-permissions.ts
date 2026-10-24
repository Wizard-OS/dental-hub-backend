import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import { ClinicPermission } from '../interfaces';

export type ClinicPermissionMap = Partial<Record<ClinicPermission, boolean>> &
  Record<string, boolean | undefined>;

const primaryPermissions: Record<ClinicPermission, boolean> = {
  [ClinicPermission.manageClinic]: true,
  [ClinicPermission.manageTeam]: true,
  [ClinicPermission.managePatients]: true,
  [ClinicPermission.viewPatientContact]: true,
  [ClinicPermission.manageSchedule]: true,
  [ClinicPermission.manageClinical]: true,
  [ClinicPermission.manageFinancial]: true,
  [ClinicPermission.viewReports]: true,
};

const defaultPermissionsByRole: Record<
  ClinicMembershipRole,
  Record<ClinicPermission, boolean>
> = {
  [ClinicMembershipRole.owner]: primaryPermissions,
  [ClinicMembershipRole.admin]: primaryPermissions,
  [ClinicMembershipRole.receptionist]: {
    [ClinicPermission.manageClinic]: false,
    [ClinicPermission.manageTeam]: false,
    [ClinicPermission.managePatients]: true,
    [ClinicPermission.viewPatientContact]: true,
    [ClinicPermission.manageSchedule]: true,
    [ClinicPermission.manageClinical]: false,
    [ClinicPermission.manageFinancial]: true,
    [ClinicPermission.viewReports]: true,
  },
  [ClinicMembershipRole.odontologist]: {
    [ClinicPermission.manageClinic]: false,
    [ClinicPermission.manageTeam]: false,
    [ClinicPermission.managePatients]: true,
    [ClinicPermission.viewPatientContact]: false,
    [ClinicPermission.manageSchedule]: false,
    [ClinicPermission.manageClinical]: true,
    [ClinicPermission.manageFinancial]: false,
    [ClinicPermission.viewReports]: false,
  },
  [ClinicMembershipRole.specialist]: {
    [ClinicPermission.manageClinic]: false,
    [ClinicPermission.manageTeam]: false,
    [ClinicPermission.managePatients]: false,
    [ClinicPermission.viewPatientContact]: false,
    [ClinicPermission.manageSchedule]: false,
    [ClinicPermission.manageClinical]: true,
    [ClinicPermission.manageFinancial]: false,
    [ClinicPermission.viewReports]: false,
  },
  [ClinicMembershipRole.assistant]: {
    [ClinicPermission.manageClinic]: false,
    [ClinicPermission.manageTeam]: false,
    [ClinicPermission.managePatients]: false,
    [ClinicPermission.viewPatientContact]: false,
    [ClinicPermission.manageSchedule]: false,
    [ClinicPermission.manageClinical]: false,
    [ClinicPermission.manageFinancial]: false,
    [ClinicPermission.viewReports]: false,
  },
};

export function isPrimaryClinicRole(role?: ClinicMembershipRole): boolean {
  return (
    role === ClinicMembershipRole.owner || role === ClinicMembershipRole.admin
  );
}

export function isSecondaryClinicRole(role?: ClinicMembershipRole): boolean {
  return (
    role === ClinicMembershipRole.odontologist ||
    role === ClinicMembershipRole.specialist ||
    role === ClinicMembershipRole.assistant
  );
}

export function hasClinicPermission(
  role: ClinicMembershipRole | undefined,
  permissionsJson: ClinicPermissionMap | undefined,
  permission: ClinicPermission,
): boolean {
  if (!role) return false;

  const explicit = permissionsJson?.[permission];

  if (explicit !== undefined) return explicit;

  return defaultPermissionsByRole[role]?.[permission];
}
