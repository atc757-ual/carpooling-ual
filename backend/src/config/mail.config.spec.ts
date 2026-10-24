import { parseMailConfig } from './mail.config';

describe('parseMailConfig', () => {
  it('defaults to the Mailpit of Docker Compose outside the tests', () => {
    expect(parseMailConfig({ NODE_ENV: 'development' })).toEqual({
      transport: 'smtp',
      from: 'Carpooling UAL <no-reply@carpooling-ual.local>',
      smtp: { host: 'localhost', port: 1025, secure: false, auth: null },
    });
  });

  it('keeps the emails in memory when running the tests', () => {
    expect(parseMailConfig({ NODE_ENV: 'test' }).transport).toBe('memory');
  });

  it('reads a real SMTP server from the environment', () => {
    expect(
      parseMailConfig({
        NODE_ENV: 'production',
        MAIL_TRANSPORT: 'smtp',
        MAIL_FROM: 'Carpooling UAL <no-reply@ual.es>',
        SMTP_HOST: 'smtp.ual.es',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'carpooling',
        SMTP_PASSWORD: 'test-only-password',
      }),
    ).toEqual({
      transport: 'smtp',
      from: 'Carpooling UAL <no-reply@ual.es>',
      smtp: {
        host: 'smtp.ual.es',
        port: 465,
        secure: true,
        auth: { user: 'carpooling', pass: 'test-only-password' },
      },
    });
  });

  it('lets MAIL_TRANSPORT choose memory explicitly', () => {
    expect(parseMailConfig({ MAIL_TRANSPORT: 'memory' }).transport).toBe(
      'memory',
    );
  });

  it('rejects an unknown MAIL_TRANSPORT', () => {
    expect(() => parseMailConfig({ MAIL_TRANSPORT: 'pigeon' })).toThrow(
      'Invalid MAIL_TRANSPORT "pigeon"',
    );
  });

  it.each(['abc', '0', '65536'])('rejects the SMTP_PORT "%s"', (port) => {
    expect(() => parseMailConfig({ SMTP_PORT: port })).toThrow(
      `Invalid SMTP_PORT "${port}"`,
    );
  });

  it('rejects an SMTP_SECURE that is not true or false', () => {
    expect(() => parseMailConfig({ SMTP_SECURE: 'yes' })).toThrow(
      'Invalid SMTP_SECURE "yes"',
    );
  });

  it.each([
    [{ SMTP_USER: 'carpooling' }],
    [{ SMTP_PASSWORD: 'test-only-password' }],
  ])('requires SMTP_USER and SMTP_PASSWORD together (%p)', (env) => {
    expect(() => parseMailConfig(env)).toThrow(
      'SMTP_USER and SMTP_PASSWORD must be set together',
    );
  });
});
