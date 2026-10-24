import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from '../appointments/entities/appointment.entity';
import { MessageTemplate } from '../message-templates/entities/message-template.entity';
import { Reminder } from './entities/reminder.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [RemindersController],
  providers: [RemindersService],
  imports: [TypeOrmModule.forFeature([Reminder, Appointment, MessageTemplate])],
  exports: [TypeOrmModule],
})
export class RemindersModule {}
