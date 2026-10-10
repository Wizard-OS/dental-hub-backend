import { apiMessage } from '../../common/i18n/api-message';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { Repository } from 'typeorm';
import { JwtPayload } from '../interfaces';
import { User } from '../entities/user.entity';
import { getRequiredEnv } from '../../config/env';
import { UserSessionsService } from '../../user-sessions/user-sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    configService: ConfigService,

    private readonly userSessionsService: UserSessionsService,
  ) {
    const jwtSecret = getRequiredEnv(
      'JWT_SECRET',
      configService.get<string>('JWT_SECRET') ?? process.env.JWT_SECRET,
    );

    super({
      secretOrKey: jwtSecret,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
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

    await this.userSessionsService.assertActiveSession(user.id, sessionId);
    await this.userSessionsService.updateLastActive(sessionId);

    user.currentSessionId = sessionId;

    return user;
  }
}
