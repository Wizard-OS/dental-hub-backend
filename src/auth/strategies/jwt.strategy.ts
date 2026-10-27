import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

import { apiMessage } from '../../common/i18n/api-message';
import { getJwtSecret } from '../../config/security';
import { UserSessionsService } from '../../user-sessions/user-sessions.service';
import { User } from '../entities/user.entity';
import { JwtPayload } from '../interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    configService: ConfigService,

    private readonly userSessionsService: UserSessionsService,
  ) {
    const jwtSecret = getJwtSecret(
      configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET,
    );

    super({
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.id !== 'string' ||
      typeof payload.sessionId !== 'string' ||
      !isUUID(payload.id) ||
      !isUUID(payload.sessionId)
    )
      throw new UnauthorizedException(
        apiMessage('api.messages.token_not_valid'),
      );

    const { id, sessionId } = payload;

    if (!sessionId) {
      throw new UnauthorizedException(
        apiMessage('api.messages.session_not_valid'),
      );
    }

    const user = await this.userRepository.findOneBy({ id });

    if (!user)
      throw new UnauthorizedException(
        apiMessage('api.messages.token_not_valid'),
      );

    if (!user.isActive)
      throw new UnauthorizedException(
        apiMessage('api.messages.user_is_inactive_talk_with_an_admin'),
      );

    const session = await this.userSessionsService.assertActiveSession(
      user.id,
      sessionId,
    );

    await this.userSessionsService.updateLastActive(
      sessionId,
      session.lastActiveAt,
    );

    user.currentSessionId = sessionId;

    return user;
  }
}
