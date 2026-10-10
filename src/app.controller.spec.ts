import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { apiMessage } from './common/i18n/api-message';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns a localized API greeting message reference', () => {
      expect(appController.getHello()).toEqual(
        apiMessage('api.messages.hello_world'),
      );
    });
  });
});
