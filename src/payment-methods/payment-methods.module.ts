import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  controllers: [PaymentMethodsController],
  providers: [PaymentMethodsService],
  imports: [TypeOrmModule.forFeature([PaymentMethod])],
  exports: [TypeOrmModule, PaymentMethodsService],
})
export class PaymentMethodsModule {}
