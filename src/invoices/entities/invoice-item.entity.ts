import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { InvoiceItemType } from '../interfaces/invoice-item-type.enum';
import { Invoice } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column('uuid')
  invoiceId: string;

  @Column('enum', {
    enum: InvoiceItemType,
    default: InvoiceItemType.custom,
  })
  type: InvoiceItemType;

  @Column('uuid', { nullable: true })
  refId: string | null;

  @Column('text')
  description: string;

  @Column('int', { default: 1 })
  qty: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lineTotal: string;
}
