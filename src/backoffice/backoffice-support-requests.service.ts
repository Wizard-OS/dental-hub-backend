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
import { SupportRequest } from '../help-center/entities/support-request.entity';
import { QueryBackofficeSupportRequestsDto } from './dto/query-backoffice-support-requests.dto';
import { UpdateBackofficeSupportRequestDto } from './dto/update-backoffice-support-request.dto';

@Injectable()
export class BackofficeSupportRequestsService {
  constructor(
    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,
  ) {}

  async findSupportRequests(queryDto: QueryBackofficeSupportRequestsDto) {
    const { limit = 10, offset = 0, search, status } = queryDto;
    const query = this.supportRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .orderBy('request.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (status) {
      query.andWhere('request.status = :status', { status });
    }

    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('request.subject ILIKE :search', {
            search: `%${search}%`,
          })
            .orWhere('request.message ILIKE :search', {
              search: `%${search}%`,
            })
            .orWhere('request.contactEmail ILIKE :search', {
              search: `%${search}%`,
            });
        }),
      );
    }

    const [items, total] = await query.getManyAndCount();

    return {
      total,
      limit,
      offset,
      items,
    };
  }

  async updateSupportRequest(
    id: string,
    dto: UpdateBackofficeSupportRequestDto,
  ) {
    this.assertUuid(id, apiMessage('api.messages.invalid_support_request_id'));

    const request = await this.supportRequestRepository.findOne({
      where: { id },
      relations: { user: true },
    });

    if (!request) {
      throw new NotFoundException(
        apiMessage('api.messages.support_request_with_id_not_found', {
          id: id,
        }),
      );
    }

    request.status = dto.status;
    return await this.supportRequestRepository.save(request);
  }

  private assertUuid(value: string, message: ApiMessage) {
    if (!isUUID(value)) {
      throw new BadRequestException(message);
    }
  }
}
