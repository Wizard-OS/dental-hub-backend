import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';

import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async create(clinicId: string, dto: CreateExpenseDto) {
    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    const expense = this.expenseRepository.create({
      ...dto,
      clinicId,
      spentAt: new Date(dto.spentAt),
      notes: dto.notes ?? null,
      recordedByMembershipId: dto.recordedByMembershipId ?? null,
    });

    return await this.expenseRepository.save(expense);
  }

  async findAll(clinicId: string) {
    return await this.expenseRepository.find({
      where: { clinicId },
      order: { spentAt: 'DESC' },
    });
  }

  async findOne(clinicId: string, id: string) {
    if (!isUUID(id)) throw new BadRequestException('Invalid expense id');

    const expense = await this.expenseRepository.findOne({
      where: { id, clinicId },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with id ${id} not found`);
    }

    return expense;
  }

  async update(clinicId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.findOne(clinicId, id);

    if (dto.clinicId && dto.clinicId !== clinicId) {
      throw new BadRequestException(
        'clinicId does not match x-clinic-id scope',
      );
    }

    Object.assign(expense, dto);

    if (dto.spentAt) {
      expense.spentAt = new Date(dto.spentAt);
    }

    return await this.expenseRepository.save(expense);
  }

  async remove(clinicId: string, id: string) {
    const expense = await this.findOne(clinicId, id);
    await this.expenseRepository.remove(expense);
    return { message: `Expense ${id} removed` };
  }

  async getTotals(clinicId: string, from?: string, to?: string) {
    const query = this.expenseRepository
      .createQueryBuilder('expense')
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .where('expense.clinicId = :clinicId', { clinicId });

    if (from) {
      query.andWhere('expense.spentAt >= :from', { from });
    }

    if (to) {
      query.andWhere('expense.spentAt <= :to', { to });
    }

    const result = await query.getRawOne<{ total: string }>();
    return result?.total ?? '0';
  }
}
