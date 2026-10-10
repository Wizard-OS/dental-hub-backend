import { Injectable } from '@nestjs/common';
import { apiMessage } from './common/i18n/api-message';

@Injectable()
export class AppService {
  getHello() {
    return apiMessage('api.messages.hello_world');
  }
}
