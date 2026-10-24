import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportRequest } from './entities/support-request.entity';

@Injectable()
export class HelpCenterService {
  constructor(
    @InjectRepository(SupportRequest)
    private readonly supportRequestRepository: Repository<SupportRequest>,
  ) {}

  getFaqs() {
    return [
      {
        id: 1,
        question: 'How do I schedule an appointment?',
        answer:
          'Go to the Appointments section and click "New Appointment". Select the patient, date, time, and treatment type.',
      },
      {
        id: 2,
        question: 'How do I update my profile information?',
        answer:
          'Navigate to Settings > Profile Settings to update your name, email, phone, and profile photo.',
      },
      {
        id: 3,
        question: 'How do I change my password?',
        answer:
          'Go to Settings > Reset Password. Enter your current password and your new password.',
      },
      {
        id: 4,
        question: 'How do I manage notification preferences?',
        answer:
          'Go to Settings > Notifications to enable or disable email, SMS, and push notifications.',
      },
      {
        id: 5,
        question: 'How do I add a payment method?',
        answer:
          'Navigate to Settings > Payment Method and click "Add Payment Method". Enter your card or bank account details.',
      },
      {
        id: 6,
        question: 'How do I generate an invoice?',
        answer:
          'Go to the Invoices section, select the patient and treatment, then click "Generate Invoice".',
      },
      {
        id: 7,
        question: 'How can I contact support?',
        answer:
          'You can submit a support request through the Help Center or email us at support@dentalhub.com.',
      },
    ];
  }

  getContactInfo() {
    return {
      email: 'support@dentalhub.com',
      phone: '+1 (800) 555-0199',
      hours: 'Monday - Friday, 9:00 AM - 6:00 PM EST',
      website: 'https://help.dentalhub.com',
    };
  }

  async createSupportRequest(
    userId: string,
    dto: CreateSupportRequestDto,
  ): Promise<SupportRequest> {
    const request = this.supportRequestRepository.create({
      ...dto,
      userId,
    });

    return await this.supportRequestRepository.save(request);
  }

  async getUserSupportRequests(userId: string): Promise<SupportRequest[]> {
    return await this.supportRequestRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
