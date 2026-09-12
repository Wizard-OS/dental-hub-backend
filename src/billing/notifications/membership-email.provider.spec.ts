import { MembershipEmailProvider } from './membership-email.provider';

describe('Membership email delivery adapter', () => {
  let previous: (string | undefined)[];
  let fetchMock: jest.SpyInstance;
  const provider = new MembershipEmailProvider();
  beforeEach(() => {
    previous = [process.env.RESEND_API_KEY, process.env.MEMBERSHIP_EMAIL_FROM];
    process.env.RESEND_API_KEY = 'test';
    process.env.MEMBERSHIP_EMAIL_FROM = 'billing@example.com';
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    ['RESEND_API_KEY', 'MEMBERSHIP_EMAIL_FROM'].forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
    fetchMock.mockRestore();
  });
  it('uses a stable idempotency key and reports acceptance only with a provider id', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }),
    );
    await expect(
      provider.send('reminder-1', {
        to: 'owner@example.com',
        subject: 'Trial',
        text: 'Reminder',
      }),
    ).resolves.toBe('email-id');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'reminder-1' }),
      }),
    );
  });
  it('fails for provider errors without claiming the message was sent', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(
      provider.send('reminder', {
        to: 'owner@example.com',
        subject: 'Trial',
        text: 'Reminder',
      }),
    ).rejects.toThrow();
  });
  it('does not attempt delivery without configuration', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      provider.send('reminder', {
        to: 'owner@example.com',
        subject: 'Trial',
        text: 'Reminder',
      }),
    ).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
