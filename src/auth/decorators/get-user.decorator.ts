import { apiMessage } from '../../common/i18n/api-message';
import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { User } from '../entities/user.entity';
import type { AuthenticatedRequest } from '../interfaces';

export const GetUser = createParamDecorator<keyof User | undefined>(
  (data, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;

    if (!user)
      throw new InternalServerErrorException(
        apiMessage('api.messages.user_not_found_request'),
      );

    if (!data) return user;

    return Reflect.get(user, data) as unknown;
  },
);
