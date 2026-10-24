import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportRequest } from './entities/support-request.entity';
import { HelpCenterController } from './help-center.controller';
import { HelpCenterService } from './help-center.service';

@Module({
  controllers: [HelpCenterController],
  providers: [HelpCenterService],
  imports: [TypeOrmModule.forFeature([SupportRequest])],
  exports: [TypeOrmModule],
})
export class HelpCenterModule {}
