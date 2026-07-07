import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetClinicPermissions = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.clinicPermissions as Record<string, boolean> | undefined;
  },
);
