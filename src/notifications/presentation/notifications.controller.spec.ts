import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  it('uses the authenticated user id when registering a push device', async () => {
    const registerPushDevice = {
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new NotificationsController(
      registerPushDevice as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
    );

    await controller.registerDevice('authenticated-user', {
      token: 'fcm-token',
      platform: 'android',
    });

    expect(registerPushDevice.execute).toHaveBeenCalledWith(
      'authenticated-user',
      'fcm-token',
      'android',
    );
  });

  it('returns not found for a notification owned by another user', async () => {
    const markRead = { execute: jest.fn().mockResolvedValue(false) };
    const controller = new NotificationsController(
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
      markRead as never,
      { execute: jest.fn() } as never,
      { execute: jest.fn() } as never,
    );

    await expect(
      controller.markRead('other-user', '84c4e924-42f4-4564-92a9-916113151af2'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
