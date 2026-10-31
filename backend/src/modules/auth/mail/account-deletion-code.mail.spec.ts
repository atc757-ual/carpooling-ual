import { buildAccountDeletionCodeMail } from './account-deletion-code.mail';

describe('buildAccountDeletionCodeMail', () => {
  it('builds the subject, text and HTML with the 6-digit code and TTL', () => {
    const mail = buildAccountDeletionCodeMail({
      to: 'ana@ual.es',
      name: 'Ana',
      code: '482910',
      expiresInMinutes: 15,
    });

    expect(mail.to).toBe('ana@ual.es');
    expect(mail.subject).toBe(
      'Tu código para eliminar la cuenta de Carpooling UAL',
    );
    expect(mail.text).toContain('Hola, Ana:');
    expect(mail.text).toContain('482910');
    expect(mail.text).toContain('Caduca en 15 minutos.');
    expect(mail.html).toContain('482910');
  });

  it('escapes HTML in the user name', () => {
    const mail = buildAccountDeletionCodeMail({
      to: 'ana@ual.es',
      name: '<script>alert(1)</script>',
      code: '482910',
      expiresInMinutes: 15,
    });

    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(mail.html).not.toContain('<script>');
  });
});
