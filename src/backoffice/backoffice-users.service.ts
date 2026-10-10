import { apiMessage, type ApiMessage } from '../common/i18n/api-message';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brackets } from 'typeorm';
import { isUUID } from 'class-validator';
import { User } from '../auth/entities/user.entity';
import { ValidRoles } from '../auth/interfaces';
import { UserSession } from '../user-sessions/entities/user-session.entity';
import { SupportRequest } from '../help-center/entities/support-request.entity';
import { QueryBackofficeUsersDto } from './dto/query-backoffice-users.dto';
import { UpdateBackofficeUserDto } from './dto/update-backoffice-user.dto';

@Injectable()
export class BackofficeUsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly userSessionRepository: Repository<UserSession>,
    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,
  ) {}

  async findUsers(queryDto: QueryBackofficeUsersDto) {
    const { limit = 10, offset = 0, search, status } = queryDto;
    const query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.memberships', 'memberships')
      .leftJoinAndSelect('memberships.clinic', 'clinic')
      .orderBy('user.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('user.email ILIKE :search', { search: `%${search}%` })
            .orWhere('user.firstName ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('user.lastName ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    if (status === 'active') {
      query.andWhere('user.isActive = true');
    }

    if (status === 'inactive') {
      query.andWhere('user.isActive = false');
    }

    const [users, total] = await query.getManyAndCount();

    return {
      total,
      limit,
      offset,
      items: users,
    };
  }

  async findUser(id: string) {
    this.assertUuid(id, apiMessage('api.messages.invalid_user_id'));

    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        memberships: { clinic: true },
      },
    });

    if (!user) {
      throw new NotFoundException(
        apiMessage('api.messages.user_with_id_not_found', { id: id }),
      );
    }

    const [sessions, supportRequests] = await Promise.all([
      this.userSessionRepository.find({
        where: { userId: id },
        order: { lastActiveAt: 'DESC' },
        take: 10,
      }),
      this.supportRequestRepository.find({
        where: { userId: id },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    return {
      ...user,
      sessions,
      supportRequests,
    };
  }

  async updateUser(id: string, dto: UpdateBackofficeUserDto) {
    this.assertUuid(id, apiMessage('api.messages.invalid_user_id'));

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(
        apiMessage('api.messages.user_with_id_not_found', { id: id }),
      );
    }

    if (dto.roles && !dto.roles.includes(ValidRoles.user)) {
      dto.roles = [...dto.roles];
    }

    Object.assign(user, dto);
    return await this.userRepository.save(user);
  }

  private assertUuid(value: string, message: ApiMessage) {
    if (!isUUID(value)) {
      throw new BadRequestException(message);
    }
  }
}
