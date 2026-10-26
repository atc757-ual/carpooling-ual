import { buildPasswordResetCodeMail } from './password-reset-code.mail';

describe('buildPasswordResetCodeMail', () => {
  const mail = buildPasswordResetCodeMail({
    to: 'ana@ual.es',
    name: 'Ana',
    code: '042137',
    expiresInMinutes: 15,
  });

  it('puts the code in the body (text and HTML), not in the subject', () => {
    expect(mail.to).toBe('ana@ual.es');
    expect(mail.subject).toBe(
      'Tu código para cambiar la contraseña de Carpooling UAL',
    );
    expect(mail.subject).not.toContain('042137');
    expect(mail.text).toContain('042137');
    expect(mail.html).toContain('042137');
  });

  it('says when the code expires', () => {
    expect(mail.text).toContain('Caduca en 15 minutos.');
    expect(mail.html).toContain('Caduca en 15 minutos.');
  });

  it('escapes the name in the HTML so a user cannot inject markup', () => {
    const injected = buildPasswordResetCodeMail({
      to: 'ana@ual.es',
      name: '<b>Ana</b> & Co',
      code: '042137',
      expiresInMinutes: 15,
    });

    expect(injected.html).toContain('&lt;b&gt;Ana&lt;/b&gt; &amp; Co');
    expect(injected.html).not.toContain('<b>Ana</b>');
  });
});
