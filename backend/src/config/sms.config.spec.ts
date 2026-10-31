import { parseSmsConfig } from './sms.config';

describe('parseSmsConfig', () => {
  it('defaults to mailpit outside the tests and no OTP domain when empty', () => {
    expect(parseSmsConfig({ NODE_ENV: 'development' })).toEqual({
      transport: 'mailpit',
      otpDomain: null,
    });
  });

  it('keeps SMS messages in memory when running tests', () => {
    expect(parseSmsConfig({ NODE_ENV: 'test' })).toEqual({
      transport: 'memory',
      otpDomain: null,
    });
  });

  it('reads SMS_TRANSPORT and normalizes SMS_OTP_DOMAIN', () => {
    expect(
      parseSmsConfig({
        SMS_TRANSPORT: 'mailpit',
        SMS_OTP_DOMAIN: '  Carpooling.UAL.es ',
      }),
    ).toEqual({
      transport: 'mailpit',
      otpDomain: 'carpooling.ual.es',
    });
    expect(parseSmsConfig({ SMS_OTP_DOMAIN: 'localhost' }).otpDomain).toBe(
      'localhost',
    );
  });

  it('rejects an unknown SMS_TRANSPORT', () => {
    expect(() => parseSmsConfig({ SMS_TRANSPORT: 'twilio' })).toThrow(
      'Invalid SMS_TRANSPORT "twilio": expected mailpit or memory',
    );
  });

  it.each(['https://ual.es', 'ual', 'ual.es/path'])(
    'rejects an invalid SMS_OTP_DOMAIN "%s"',
    (domain) => {
      expect(() => parseSmsConfig({ SMS_OTP_DOMAIN: domain })).toThrow(
        'Invalid SMS_OTP_DOMAIN',
      );
    },
  );
});
