import { Injectable } from '@nestjs/common';
import { QueryBackofficeClinicsDto } from './dto/query-backoffice-clinics.dto';
import { QueryBackofficeUsersDto } from './dto/query-backoffice-users.dto';
import { QueryBackofficeSupportRequestsDto } from './dto/query-backoffice-support-requests.dto';
import { UpdateBackofficeClinicDto } from './dto/update-backoffice-clinic.dto';
import { UpdateBackofficeUserDto } from './dto/update-backoffice-user.dto';
import { UpdateBackofficeSubscriptionDto } from './dto/update-backoffice-subscription.dto';
import { UpdateBackofficeSupportRequestDto } from './dto/update-backoffice-support-request.dto';
import { BackofficeOverviewService } from './backoffice-overview.service';
import { BackofficeClinicsService } from './backoffice-clinics.service';
import { BackofficeUsersService } from './backoffice-users.service';
import { BackofficeSupportRequestsService } from './backoffice-support-requests.service';

@Injectable()
export class BackofficeService {
  constructor(
    private readonly overview: BackofficeOverviewService,
    private readonly clinics: BackofficeClinicsService,
    private readonly users: BackofficeUsersService,
    private readonly supportRequests: BackofficeSupportRequestsService,
  ) {}

  getOverview() {
    return this.overview.getOverview();
  }
  findClinics(queryDto: QueryBackofficeClinicsDto) {
    return this.clinics.findClinics(queryDto);
  }
  findClinic(id: string): Promise<unknown> {
    return this.clinics.findClinic(id);
  }
  updateClinic(id: string, dto: UpdateBackofficeClinicDto) {
    return this.clinics.updateClinic(id, dto);
  }
  updateClinicSubscription(
    id: string,
    dto: UpdateBackofficeSubscriptionDto,
  ): Promise<unknown> {
    return this.clinics.updateClinicSubscription(id, dto);
  }
  findUsers(queryDto: QueryBackofficeUsersDto) {
    return this.users.findUsers(queryDto);
  }
  findUser(id: string) {
    return this.users.findUser(id);
  }
  updateUser(id: string, dto: UpdateBackofficeUserDto) {
    return this.users.updateUser(id, dto);
  }
  findSupportRequests(queryDto: QueryBackofficeSupportRequestsDto) {
    return this.supportRequests.findSupportRequests(queryDto);
  }
  updateSupportRequest(id: string, dto: UpdateBackofficeSupportRequestDto) {
    return this.supportRequests.updateSupportRequest(id, dto);
  }
}
