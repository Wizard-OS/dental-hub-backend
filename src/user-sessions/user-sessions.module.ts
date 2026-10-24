import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserSession } from './entities/user-session.entity';
import { UserSessionsController } from './user-sessions.controller';
import { UserSessionsService } from './user-sessions.service';

@Module({
  controllers: [UserSessionsController],
  providers: [UserSessionsService],
  imports: [TypeOrmModule.forFeature([UserSession])],
  exports: [TypeOrmModule, UserSessionsService],
})
export class UserSessionsModule {}
