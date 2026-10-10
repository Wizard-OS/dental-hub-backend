import { apiMessage } from '../../common/i18n/api-message';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { Patient } from '../entities/patient.entity';
import { ClinicPermission } from '../../auth/interfaces';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { AppointmentStatus } from '../../appointments/interfaces/AppointmentStatus.enum';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';
import {
  hasClinicPermission,
  isPrimaryClinicRole,
  isSecondaryClinicRole,
} from '../../auth/utils/clinic-permissions';
import { PatientProfessionalAssignment } from '../../patient-assignments/entities/patient-professional-assignment.entity';

export interface ClinicAccessContext {
  clinicId: string;
  membershipId: string;
  role: ClinicMembershipRole;
  permissionsJson?: Record<string, boolean>;
}

@Injectable()
export class PatientAccessService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,

    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,

    @InjectRepository(PatientProfessionalAssignment)
    private readonly assignmentRepository: Repository<PatientProfessionalAssignment>,
  ) {}

  canViewAllPatients(context: ClinicAccessContext): boolean {
    return (
      isPrimaryClinicRole(context.role) ||
      context.role === ClinicMembershipRole.receptionist ||
      hasClinicPermission(
        context.role,
        context.permissionsJson,
        ClinicPermission.managePatients,
      )
    );
  }

  canViewPatientContact(context: ClinicAccessContext): boolean {
    return hasClinicPermission(
      context.role,
      context.permissionsJson,
      ClinicPermission.viewPatientContact,
    );
  }

  canManagePatients(context: ClinicAccessContext): boolean {
    return hasClinicPermission(
      context.role,
      context.permissionsJson,
      ClinicPermission.managePatients,
    );
  }

  canManageClinical(context: ClinicAccessContext): boolean {
    return hasClinicPermission(
      context.role,
      context.permissionsJson,
      ClinicPermission.manageClinical,
    );
  }

  canManageFinancial(context: ClinicAccessContext): boolean {
    return hasClinicPermission(
      context.role,
      context.permissionsJson,
      ClinicPermission.manageFinancial,
    );
  }

  assertCanManagePatients(context: ClinicAccessContext) {
    if (!this.canManagePatients(context)) {
      throw new ForbiddenException(
        apiMessage('api.messages.user_cannot_manage_patients'),
      );
    }
  }

  assertCanManageClinical(context: ClinicAccessContext) {
    if (!this.canManageClinical(context)) {
      throw new ForbiddenException(
        apiMessage('api.messages.user_cannot_edit_clinical_records'),
      );
    }
  }

  assertCanManageFinancial(context: ClinicAccessContext) {
    if (!this.canManageFinancial(context)) {
      throw new ForbiddenException(
        apiMessage('api.messages.user_cannot_access_financial_data'),
      );
    }
  }

  async assertPatientAccessible(
    context: ClinicAccessContext,
    patientId: string,
  ) {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, clinicId: context.clinicId },
      select: { id: true },
    });

    if (!patient) {
      throw new NotFoundException(
        apiMessage('api.messages.patient_by_id_does_not_belong_to_clinic', {
          patientId: patientId,
        }),
      );
    }

    if (this.canViewAllPatients(context)) return;

    if (
      isSecondaryClinicRole(context.role) &&
      (await this.hasAssignedPatientAccess(context, patientId))
    ) {
      return;
    }

    throw new ForbiddenException(
      apiMessage('api.messages.patient_is_not_assigned_to_this_profile'),
    );
  }

  async hasAssignedPatientAccess(
    context: ClinicAccessContext,
    patientId: string,
  ): Promise<boolean> {
    const [permanent, temporary] = await Promise.all([
      this.assignmentRepository.findOne({
        where: {
          clinicId: context.clinicId,
          patientId,
          professionalMembershipId: context.membershipId,
          isActive: true,
        },
        select: { id: true },
      }),
      this.appointmentRepository
        .createQueryBuilder('appointment')
        .select('appointment.id')
        .where('appointment.clinicId = :clinicId', {
          clinicId: context.clinicId,
        })
        .andWhere('appointment.patientId = :patientId', { patientId })
        .andWhere(
          'appointment.professionalMembershipId = :professionalMembershipId',
          { professionalMembershipId: context.membershipId },
        )
        .andWhere('appointment.status != :cancelled', {
          cancelled: AppointmentStatus.CANCELLED,
        })
        .getOne(),
    ]);

    return permanent != null || temporary != null;
  }

  applyPatientAccessFilter(
    query: SelectQueryBuilder<Patient>,
    alias: string,
    context: ClinicAccessContext,
  ): SelectQueryBuilder<Patient> {
    query.where(`${alias}.clinicId = :clinicId`, {
      clinicId: context.clinicId,
    });

    if (this.canViewAllPatients(context)) return query;

    const permanentAccessSubQuery = query
      .subQuery()
      .select('assignment."patientId"')
      .from(PatientProfessionalAssignment, 'assignment')
      .where('assignment."clinicId" = :clinicId')
      .andWhere('assignment."professionalMembershipId" = :membershipId')
      .andWhere('assignment."isActive" = true')
      .getQuery();
    const temporaryAccessSubQuery = query
      .subQuery()
      .select('appointment."patientId"')
      .from(Appointment, 'appointment')
      .where('appointment."clinicId" = :clinicId')
      .andWhere('appointment."professionalMembershipId" = :membershipId')
      .andWhere('appointment.status != :cancelled')
      .getQuery();

    query.andWhere(
      new Brackets((qb) => {
        qb.where(`${alias}.id IN ${permanentAccessSubQuery}`).orWhere(
          `${alias}.id IN ${temporaryAccessSubQuery}`,
        );
      }),
    );
    query.setParameters({
      membershipId: context.membershipId,
      cancelled: AppointmentStatus.CANCELLED,
    });

    return query;
  }

  sanitizePatient<T extends Patient | null | undefined>(
    patient: T,
    context: ClinicAccessContext,
  ): T {
    if (!patient || this.canViewPatientContact(context)) return patient;

    const sanitized = patient as unknown as Record<string, unknown>;
    sanitized.email = null;
    sanitized.phone = null;
    sanitized.address = null;
    sanitized.streetAddress = null;
    sanitized.addressNumber = null;
    sanitized.neighborhood = null;
    sanitized.city = null;
    sanitized.postalCode = null;
    sanitized.emergencyContact = null;
    return patient;
  }

  sanitizePatients<T extends Patient>(
    patients: T[],
    context: ClinicAccessContext,
  ): T[] {
    return patients.map((patient) => this.sanitizePatient(patient, context));
  }
}
