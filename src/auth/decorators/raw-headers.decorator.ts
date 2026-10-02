import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const RawHeaders = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();

    return req.rawHeaders;
  },
);
