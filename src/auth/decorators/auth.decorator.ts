import { applyDecorators, UseGuards } from '@nestjs/common';

import { ClinicPermissionGuard } from '../guards/clinic-permission.guard';
import { ClinicRoleGuard } from '../guards/clinic-role.guard';
import { ClinicScopeGuard } from '../guards/clinic-scope.guard';
import { UserRoleGuard } from '../guards/user-role.guard';
import { ValidRoles } from '../interfaces';
import { RoleProtected } from './role-protected.decorator';

export function Auth(...roles: ValidRoles[]) {
  return applyDecorators(RoleProtected(...roles), UseGuards(UserRoleGuard));
}

export function AuthClinic(...roles: ValidRoles[]) {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(
      UserRoleGuard,
      ClinicScopeGuard,
      ClinicRoleGuard,
      ClinicPermissionGuard,
    ),
  );
}
