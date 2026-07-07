import { AuthGuard } from '@nestjs/passport';

import { applyDecorators, UseGuards } from '@nestjs/common';

import { ValidRoles } from '../interfaces';
import { ClinicRoleGuard } from '../guards/clinic-role.guard';
import { UserRoleGuard } from '../guards/user-role.guard';
import { RoleProtected } from './role-protected.decorator';
import { ClinicScopeGuard } from '../guards/clinic-scope.guard';

export function Auth(...roles: ValidRoles[]) {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(AuthGuard(), UserRoleGuard),
  );
}

export function AuthClinic(...roles: ValidRoles[]) {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(AuthGuard(), UserRoleGuard, ClinicScopeGuard, ClinicRoleGuard),
  );
}
