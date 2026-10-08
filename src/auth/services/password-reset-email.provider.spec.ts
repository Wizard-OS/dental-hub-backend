import { PasswordResetEmailProvider } from './password-reset-email.provider';

describe('PasswordResetEmailProvider', () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalAuthFrom = process.env.AUTH_EMAIL_FROM;
  const originalMembershipFrom = process.env.MEMBERSHIP_EMAIL_FROM;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalAuthFrom === undefined) delete process.env.AUTH_EMAIL_FROM;
    else process.env.AUTH_EMAIL_FROM = originalAuthFrom;
    if (originalMembershipFrom === undefined)
      delete process.env.MEMBERSHIP_EMAIL_FROM;
    else process.env.MEMBERSHIP_EMAIL_FROM = originalMembershipFrom;
    global.fetch = originalFetch;
  });

  it('sends password reset codes through the configured email provider', async () => {
    process.env.RESEND_API_KEY = 'resend-test-key';
    process.env.AUTH_EMAIL_FROM = 'auth@dentalhub.test';
    const fetchMock: jest.MockedFunction<typeof global.fetch> = jest
      .fn()
      .mockResolvedValue(new Response());
    global.fetch = fetchMock;

    await new PasswordResetEmailProvider().sendCode(
      'doctor@dentalhub.test',
      '123456',
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails');
    expect(request?.method).toBe('POST');
    expect(new Headers(request?.headers).get('authorization')).toBe(
      'Bearer resend-test-key',
    );
    if (typeof request?.body !== 'string')
      throw new Error('Password reset email request body must be JSON');
    expect(request.body).toContain('123456');
  });
});
