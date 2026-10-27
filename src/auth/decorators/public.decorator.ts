import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

export const IS_PUBLIC = 'auth:public';
export const Public = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC, true),
    ApiOperation({ summary: undefined, security: [] }),
  );
