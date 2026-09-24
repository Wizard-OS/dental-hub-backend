import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, Repository } from 'typeorm';

import { Clinic } from './entities/clinic.entity';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { UpdateAppointmentSettingsDto } from './dto/update-appointment-settings.dto';
import {
  AppointmentAvailabilityService,
  ClinicScheduleContext,
} from './appointment-availability.service';
import { ClinicMembership } from '../clinic-memberships/entities/clinic-membership.entity';
import { ClinicMembershipRole } from '../clinic-memberships/interfaces/clinic-membership-role.enum';
import { CountriesService } from '../common/countries.service';
import { CountryMetadata } from '../common/interfaces/country-metadata.interface';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,

    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepository: Repository<ClinicMembership>,

    private readonly dataSource: DataSource,

    private readonly countriesService: CountriesService,

    private readonly appointmentAvailabilityService: AppointmentAvailabilityService,
  ) {}

  async create(ownerUserId: string, createClinicDto: CreateClinicDto) {
    try {
      const clinicData = await this.applyCountryDefaults(createClinicDto);

      return await this.dataSource.transaction(async (manager) => {
        const clinic = manager.create(Clinic, clinicData);
        const savedClinic = await manager.save(clinic);

        const ownerMembership = manager.create(ClinicMembership, {
          clinicId: savedClinic.id,
          userId: ownerUserId,
          role: ClinicMembershipRole.owner,
          permissionsJson: {
            canManageClinic: true,
            canManageTeam: true,
            canManageBilling: true,
            canManageSchedule: true,
          },
        });

        await manager.save(ownerMembership);

        return savedClinic;
      });
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async findAllForUser(userId: string) {
    const memberships = await this.clinicMembershipRepository.find({
      where: { userId, isActive: true, clinic: { isActive: true } },
      relations: { clinic: true },
      order: { createdAt: 'DESC' },
    });

    return memberships.map((membership) => ({
      ...membership.clinic,
      membershipId: membership.id,
      membershipRole: membership.role,
      permissionsJson: membership.permissionsJson ?? {},
    }));
  }

  async findOneForUser(userId: string, id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinic id');
    }

    const membership = await this.clinicMembershipRepository.findOne({
      where: {
        clinicId: id,
        userId,
        isActive: true,
        clinic: { isActive: true },
      },
      relations: { clinic: true },
    });

    if (!membership) {
      throw new NotFoundException(`Clinic with id ${id} not found`);
    }

    return {
      ...membership.clinic,
      membershipId: membership.id,
      membershipRole: membership.role,
      permissionsJson: membership.permissionsJson ?? {},
    };
  }

  async findOne(id: string) {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid clinic id');
    }

    const clinic = await this.clinicRepository.findOne({
      where: { id, isActive: true },
    });
    if (!clinic) throw new NotFoundException(`Clinic with id ${id} not found`);

    return clinic;
  }

  async update(
    scopedClinicId: string,
    id: string,
    updateClinicDto: UpdateClinicDto,
  ) {
    this.ensureClinicScope(scopedClinicId, id);

    const clinic = await this.findOne(id);
    const clinicData = await this.applyCountryDefaults(updateClinicDto);
    Object.assign(clinic, clinicData);

    try {
      return await this.clinicRepository.save(clinic);
    } catch (error) {
      this.handleDBErrors(error);
    }
  }

  async getAppointmentSettings(scopedClinicId: string, id: string) {
    return this.appointmentAvailabilityService.getClinicSettings(
      scopedClinicId,
      id,
    );
  }

  async updateAppointmentSettings(
    scopedClinicId: string,
    id: string,
    dto: UpdateAppointmentSettingsDto,
  ) {
    return this.appointmentAvailabilityService.updateClinicSettings(
      scopedClinicId,
      id,
      dto,
    );
  }

  async getProfessionalAppointmentSettings(
    context: ClinicScheduleContext,
    id: string,
    membershipId: string,
  ) {
    return this.appointmentAvailabilityService.getProfessionalSettings(
      context,
      id,
      membershipId,
    );
  }

  async updateProfessionalAppointmentSettings(
    context: ClinicScheduleContext,
    id: string,
    membershipId: string,
    dto: UpdateAppointmentSettingsDto,
  ) {
    return this.appointmentAvailabilityService.updateProfessionalSettings(
      context,
      id,
      membershipId,
      dto,
    );
  }

  async remove(scopedClinicId: string, id: string) {
    this.ensureClinicScope(scopedClinicId, id);

    const clinic = await this.findOne(id);
    clinic.isActive = false;
    return await this.clinicRepository.save(clinic);
  }

  private ensureClinicScope(scopedClinicId: string, id: string) {
    if (scopedClinicId !== id) {
      throw new BadRequestException(
        'Clinic id does not match x-clinic-id scope',
      );
    }
  }

  private async applyCountryDefaults<
    T extends CreateClinicDto | UpdateClinicDto,
  >(dto: T): Promise<T & Partial<Clinic>> {
    if (!dto.countryCode) {
      return dto;
    }

    const country = await this.countriesService.findByCode(dto.countryCode);

    return {
      ...dto,
      ...this.mapCountryToClinic(country),
      ...(dto.currency ? { currency: dto.currency } : {}),
    };
  }

  private mapCountryToClinic(country: CountryMetadata): Partial<Clinic> {
    return {
      countryCode: country.countryCode,
      countryName: country.countryName,
      currency: country.defaultCurrency,
      callingCodes: country.callingCodes,
      defaultCallingCode: country.defaultCallingCode,
    };
  }

  private handleDBErrors(error: unknown): never {
    if (error instanceof Object && 'code' in error && error.code === '23505') {
      throw new BadRequestException((error as Record<string, unknown>).detail);
    }

    throw new InternalServerErrorException('Please check server logs');
  }
}
