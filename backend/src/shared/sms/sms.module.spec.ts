import type { MailConfig } from '../../config/mail.config';
import type { SmsConfig } from '../../config/sms.config';
import { MailpitSmsSender } from './mailpit-sms-sender';
import { MemorySmsSender } from './memory-sms-sender';
import { formatPhoneForDisplay } from './sms-sender';
import { createSmsSender } from './sms.module';

const MAIL_CONFIG: MailConfig = {
  transport: 'smtp',
  from: 'Carpooling UAL <no-reply@carpooling-ual.local>',
  smtp: { host: 'localhost', port: 1025, secure: false, auth: null },
};

const SMS_CONFIG: SmsConfig = {
  transport: 'mailpit',
  otpDomain: null,
};

describe('createSmsSender', () => {
  it('uses Mailpit by default in development', () => {
    expect(createSmsSender(SMS_CONFIG, MAIL_CONFIG)).toBeInstanceOf(
      MailpitSmsSender,
    );
  });

  it('keeps SMS messages in memory for the tests', () => {
    expect(
      createSmsSender({ ...SMS_CONFIG, transport: 'memory' }, MAIL_CONFIG),
    ).toBeInstanceOf(MemorySmsSender);
  });
});

describe('formatPhoneForDisplay', () => {
  it('formats Spanish E.164 numbers with spaces and leaves others intact', () => {
    expect(formatPhoneForDisplay('+34600123456')).toBe('+34 600 123 456');
    expect(formatPhoneForDisplay('+33123456789')).toBe('+33123456789');
  });
});

describe('MemorySmsSender', () => {
  it('returns the SMS messages sent to a phone number, including the last one', async () => {
    const sender = new MemorySmsSender();

    await sender.send({ to: '+34600123456', text: 'first' });
    await sender.send({ to: '+34699000111', text: 'other' });
    await sender.send({ to: '+34600123456', text: 'second' });

    expect(sender.sentTo('+34600123456').map(({ text }) => text)).toEqual([
      'first',
      'second',
    ]);
    expect(sender.lastSentTo('+34600123456')?.text).toBe('second');
    expect(sender.lastSentTo('+34600000000')).toBeUndefined();
  });
});
