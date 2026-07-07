import { ValidRoles } from '../../auth/interfaces';
import { Gender } from '../../common/interfaces/gender.enum';
import { InvoiceStatus } from '../../invoices/InvoiceStatus/InvoiceStatus.enum';
import { InvoiceItemType } from '../../invoices/interfaces/invoice-item-type.enum';
import { AppointmentStatus } from '../../appointments/interfaces/AppointmentStatus.enum';
import { ClinicMembershipRole } from '../../clinic-memberships/interfaces/clinic-membership-role.enum';

export interface SeedUser {
  code: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordPlain: string;
  roles: ValidRoles[];
  profilePhotoUrl?: string;
}

export interface SeedClinic {
  code: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface SeedMembership {
  clinicCode: string;
  userCode: string;
  role: ClinicMembershipRole;
  permissionsJson?: Record<string, boolean>;
}

export interface SeedPatient {
  code: string;
  clinicCode: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  address?: string;
  phone?: string;
}

export interface SeedAppointmentType {
  code: string;
  clinicCode: string;
  name: string;
  durationMin: number;
  defaultPrice: string;
  color?: string;
}

export interface SeedAppointment {
  clinicCode: string;
  patientCode: string;
  appointmentTypeCode: string;
  professionalUserCode: string;
  description: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
}

export interface SeedInvoice {
  code: string;
  clinicCode: string;
  patientCode: string;
  number: string;
  discount: string;
  tax: string;
  totalAmount: string;
  status: InvoiceStatus;
  dueAt?: string;
}

export interface SeedInvoiceItem {
  invoiceCode: string;
  type: InvoiceItemType;
  description: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
}

export interface SeedPayment {
  invoiceCode: string;
  amount: string;
  method: string;
  paidAt: string;
  receivedByUserCode?: string;
  reference?: string;
}

interface SeedData {
  clinics: SeedClinic[];
  users: SeedUser[];
  memberships: SeedMembership[];
  patients: SeedPatient[];
  appointmentTypes: SeedAppointmentType[];
  appointments: SeedAppointment[];
  invoices: SeedInvoice[];
  invoiceItems: SeedInvoiceItem[];
  payments: SeedPayment[];
}

export const initialData: SeedData = {
  clinics: [
    {
      code: 'clinic-main',
      name: 'Dental Hub Centro',
      timezone: 'America/Montevideo',
      currency: 'USD',
    },
    {
      code: 'clinic-east',
      name: 'Dental Hub Pocitos',
      timezone: 'America/Montevideo',
      currency: 'USD',
    },
  ],
  users: [
    {
      code: 'admin-1',
      email: 'test1@google.com',
      firstName: 'Test',
      lastName: 'One',
      passwordPlain: 'Abc123',
      roles: [ValidRoles.admin],
    },
    {
      code: 'doctor-1',
      email: 'test2@google.com',
      firstName: 'Test',
      lastName: 'Two',
      passwordPlain: 'Abc123',
      roles: [ValidRoles.user, ValidRoles.superUser],
    },
    {
      code: 'doctor-2',
      email: 'test3@google.com',
      firstName: 'Test',
      lastName: 'Three',
      passwordPlain: 'Abc123',
      roles: [ValidRoles.odontologist],
    },
  ],
  memberships: [
    {
      clinicCode: 'clinic-main',
      userCode: 'admin-1',
      role: ClinicMembershipRole.owner,
      permissionsJson: {
        canManageClinic: true,
        canManageTeam: true,
        canManageBilling: true,
        canManageSchedule: true,
      },
    },
    {
      clinicCode: 'clinic-main',
      userCode: 'doctor-1',
      role: ClinicMembershipRole.odontologist,
    },
    {
      clinicCode: 'clinic-east',
      userCode: 'doctor-2',
      role: ClinicMembershipRole.owner,
      permissionsJson: {
        canManageClinic: true,
        canManageTeam: true,
        canManageSchedule: true,
      },
    },
  ],
  patients: [
    {
      code: 'patient-ana',
      clinicCode: 'clinic-main',
      email: 'ana.perez@example.com',
      firstName: 'Ana',
      lastName: 'Perez',
      birthDate: '1993-08-20',
      gender: Gender.FEMALE,
      address: 'Montevideo Centro',
      phone: '+59890000001',
    },
    {
      code: 'patient-luis',
      clinicCode: 'clinic-main',
      email: 'luis.mendez@example.com',
      firstName: 'Luis',
      lastName: 'Mendez',
      birthDate: '1988-03-11',
      gender: Gender.MALE,
      address: 'Pocitos',
      phone: '+59890000002',
    },
    {
      code: 'patient-sofia',
      clinicCode: 'clinic-east',
      email: 'sofia.romero@example.com',
      firstName: 'Sofia',
      lastName: 'Romero',
      birthDate: '1997-11-05',
      gender: Gender.FEMALE,
      address: 'Parque Batlle',
      phone: '+59890000003',
    },
  ],
  appointmentTypes: [
    {
      code: 'type-general',
      clinicCode: 'clinic-main',
      name: 'Consulta General',
      durationMin: 30,
      defaultPrice: '60.00',
      color: '#1f7a8c',
    },
    {
      code: 'type-cleaning',
      clinicCode: 'clinic-main',
      name: 'Limpieza',
      durationMin: 45,
      defaultPrice: '90.00',
      color: '#2a9d8f',
    },
    {
      code: 'type-urgency',
      clinicCode: 'clinic-east',
      name: 'Urgencia',
      durationMin: 30,
      defaultPrice: '120.00',
      color: '#e76f51',
    },
  ],
  appointments: [
    {
      clinicCode: 'clinic-main',
      patientCode: 'patient-ana',
      appointmentTypeCode: 'type-general',
      professionalUserCode: 'doctor-1',
      description: 'Control inicial',
      startTime: '2026-03-10T12:00:00.000Z',
      endTime: '2026-03-10T12:30:00.000Z',
      status: AppointmentStatus.CONFIRMED,
    },
    {
      clinicCode: 'clinic-main',
      patientCode: 'patient-luis',
      appointmentTypeCode: 'type-cleaning',
      professionalUserCode: 'doctor-1',
      description: 'Limpieza semestral',
      startTime: '2026-03-11T13:00:00.000Z',
      endTime: '2026-03-11T13:45:00.000Z',
      status: AppointmentStatus.SCHEDULED,
    },
    {
      clinicCode: 'clinic-east',
      patientCode: 'patient-sofia',
      appointmentTypeCode: 'type-urgency',
      professionalUserCode: 'doctor-2',
      description: 'Dolor agudo',
      startTime: '2026-03-12T14:00:00.000Z',
      endTime: '2026-03-12T14:30:00.000Z',
      status: AppointmentStatus.SCHEDULED,
    },
  ],
  invoices: [
    {
      code: 'inv-ana-001',
      clinicCode: 'clinic-main',
      patientCode: 'patient-ana',
      number: 'INV-MAIN-0001',
      discount: '0.00',
      tax: '0.00',
      totalAmount: '100.00',
      status: InvoiceStatus.PARTIALLY_PAID,
      dueAt: '2026-03-20T00:00:00.000Z',
    },
    {
      code: 'inv-luis-001',
      clinicCode: 'clinic-main',
      patientCode: 'patient-luis',
      number: 'INV-MAIN-0002',
      discount: '10.00',
      tax: '0.00',
      totalAmount: '80.00',
      status: InvoiceStatus.PENDING,
      dueAt: '2026-03-18T00:00:00.000Z',
    },
    {
      code: 'inv-sofia-001',
      clinicCode: 'clinic-east',
      patientCode: 'patient-sofia',
      number: 'INV-EAST-0001',
      discount: '0.00',
      tax: '0.00',
      totalAmount: '120.00',
      status: InvoiceStatus.PAID,
      dueAt: '2026-03-22T00:00:00.000Z',
    },
  ],
  invoiceItems: [
    {
      invoiceCode: 'inv-ana-001',
      type: InvoiceItemType.custom,
      description: 'Consulta General',
      qty: 1,
      unitPrice: '100.00',
      lineTotal: '100.00',
    },
    {
      invoiceCode: 'inv-luis-001',
      type: InvoiceItemType.custom,
      description: 'Limpieza',
      qty: 1,
      unitPrice: '90.00',
      lineTotal: '90.00',
    },
    {
      invoiceCode: 'inv-sofia-001',
      type: InvoiceItemType.custom,
      description: 'Urgencia',
      qty: 1,
      unitPrice: '120.00',
      lineTotal: '120.00',
    },
  ],
  payments: [
    {
      invoiceCode: 'inv-ana-001',
      amount: '40.00',
      method: 'cash',
      paidAt: '2026-03-10T12:45:00.000Z',
      receivedByUserCode: 'admin-1',
      reference: 'PAY-MAIN-ANA-01',
    },
    {
      invoiceCode: 'inv-sofia-001',
      amount: '120.00',
      method: 'card',
      paidAt: '2026-03-12T14:45:00.000Z',
      receivedByUserCode: 'doctor-2',
      reference: 'PAY-EAST-SOFIA-01',
    },
  ],
};
