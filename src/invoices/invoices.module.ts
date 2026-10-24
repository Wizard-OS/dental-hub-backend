import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Patient } from '../patients/entities/patient.entity';
import { Treatment } from '../treatments/entities/treatment.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService],
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, Patient, Treatment]),
  ],
  exports: [TypeOrmModule],
})
export class InvoicesModule {}
