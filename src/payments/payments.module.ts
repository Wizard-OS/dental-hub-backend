import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Invoice } from '../invoices/entities/invoice.entity';
import { Treatment } from '../treatments/entities/treatment.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  imports: [TypeOrmModule.forFeature([Payment, Invoice, Treatment])],
  exports: [TypeOrmModule],
})
export class PaymentsModule {}
