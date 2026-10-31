import { CODE_TTL_MINUTES } from '../email-codes.service';
import { buildPhoneVerificationCodeSms } from './phone-verification-code.sms';

// Alfabeto básico GSM 03.38 (7 bits): hasta 160 caracteres en un único SMS
const GSM_7_BASIC_CHARSET = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
const GSM_7_MAX_LENGTH = 160;

describe('buildPhoneVerificationCodeSms', () => {
  it('builds the SMS text without the WebOTP line when SMS_OTP_DOMAIN is empty', () => {
    const sms = buildPhoneVerificationCodeSms({
      to: '+34600123456',
      code: '123456',
      expiresInMinutes: CODE_TTL_MINUTES,
      otpDomain: null,
    });

    expect(sms).toEqual({
      to: '+34600123456',
      text: `Carpooling UAL: tu codigo de verificacion es 123456. Caduca en ${CODE_TTL_MINUTES} min. No lo compartas con nadie.`,
    });
  });

  it('appends the WebOTP line (@<domain> #123456) when SMS_OTP_DOMAIN is set', () => {
    const sms = buildPhoneVerificationCodeSms({
      to: '+34600123456',
      code: '123456',
      expiresInMinutes: CODE_TTL_MINUTES,
      otpDomain: 'carpooling.ual.es',
    });

    expect(sms.text).toBe(
      `Carpooling UAL: tu codigo de verificacion es 123456. Caduca en ${CODE_TTL_MINUTES} min. No lo compartas con nadie.\n\n@carpooling.ual.es #123456`,
    );
  });

  it('fits in a single GSM-7 SMS (<= 160 chars, only GSM-7 basic characters and no Spanish acute accents)', () => {
    const { text } = buildPhoneVerificationCodeSms({
      to: '+34600123456',
      code: '123456',
      expiresInMinutes: CODE_TTL_MINUTES,
      otpDomain: 'carpooling.ual.es',
    });

    expect(text.length).toBeLessThanOrEqual(GSM_7_MAX_LENGTH);
    expect([...text].every((ch) => GSM_7_BASIC_CHARSET.has(ch))).toBe(true);
    expect(text).not.toMatch(/[áéíóúÁÉÍÓÚ]/);
  });
});
