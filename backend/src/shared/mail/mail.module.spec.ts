import type { MailConfig } from '../../config/mail.config';
import { createMailSender } from './mail.module';
import { MemoryMailSender } from './memory-mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';

const CONFIG: MailConfig = {
  transport: 'smtp',
  from: 'Carpooling UAL <no-reply@carpooling-ual.local>',
  smtp: { host: 'localhost', port: 1025, secure: false, auth: null },
};

describe('createMailSender', () => {
  it('sends by SMTP by default', () => {
    expect(createMailSender(CONFIG)).toBeInstanceOf(SmtpMailSender);
  });

  it('keeps the emails in memory for the tests', () => {
    expect(createMailSender({ ...CONFIG, transport: 'memory' })).toBeInstanceOf(
      MemoryMailSender,
    );
  });
});

describe('MemoryMailSender', () => {
  it('returns the emails of an address, the last one included', async () => {
    const sender = new MemoryMailSender();
    const mail = { subject: 's', text: 't', html: 'h' };

    await sender.send({ ...mail, to: 'ana@ual.es', subject: 'first' });
    await sender.send({ ...mail, to: 'bob@ual.es' });
    await sender.send({ ...mail, to: 'Ana@UAL.es', subject: 'second' });

    expect(sender.sentTo('ana@ual.es').map(({ subject }) => subject)).toEqual([
      'first',
      'second',
    ]);
    expect(sender.lastSentTo('ANA@ual.es')?.subject).toBe('second');
    expect(sender.lastSentTo('nobody@ual.es')).toBeUndefined();
  });
});
