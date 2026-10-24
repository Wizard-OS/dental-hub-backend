import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from '../appointments/entities/appointment.entity';
import { MessageTemplate } from '../message-templates/entities/message-template.entity';
import { Patient } from '../patients/entities/patient.entity';
import { OutboundMessage } from './entities/outbound-message.entity';
import { OutboundMessagesController } from './outbound-messages.controller';
import { OutboundMessagesService } from './outbound-messages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutboundMessage,
      Patient,
      Appointment,
      MessageTemplate,
    ]),
  ],
  controllers: [OutboundMessagesController],
  providers: [OutboundMessagesService],
  exports: [TypeOrmModule, OutboundMessagesService],
})
export class OutboundMessagesModule {}
