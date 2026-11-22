import { buildCodeMail, CodeMail } from './code-mail';

const ANA: CodeMail = {
  to: 'ana@ual.es',
  name: 'Ana',
  code: '042137',
  expiresInMinutes: 15,
  language: 'es',
};

describe('buildCodeMail', () => {
  it('puts the code in the body (text and HTML), not in the subject', () => {
    const mail = buildCodeMail('verification', ANA);

    expect(mail.to).toBe('ana@ual.es');
    expect(mail.subject).toBe('Tu código de verificación de Carpooling UAL');
    expect(mail.subject).not.toContain('042137');
    expect(mail.text).toContain('042137');
    expect(mail.html).toContain('042137');
  });

  it('says when the code expires', () => {
    const mail = buildCodeMail('verification', ANA);

    expect(mail.text).toContain('Caduca en 15 minutos.');
    expect(mail.html).toContain('Caduca en 15 minutos.');
  });

  it('says what each code is for', () => {
    expect(buildCodeMail('passwordReset', ANA).subject).toBe(
      'Tu código para cambiar la contraseña de Carpooling UAL',
    );
    expect(buildCodeMail('accountDeletion', ANA).text).toContain(
      'tu cuenta no se eliminará sin este código',
    );
  });

  it('writes in the language of the user', () => {
    const mail = buildCodeMail('passwordReset', { ...ANA, language: 'en' });

    expect(mail.subject).toBe(
      'Your code to change your Carpooling UAL password',
    );
    expect(mail.text).toContain('Hi Ana,');
    expect(mail.text).toContain('It expires in 15 minutes.');
    expect(mail.html).toContain('your password will not change');
  });

  it('escapes the name in the HTML so a user cannot inject markup', () => {
    const injected = buildCodeMail('verification', {
      ...ANA,
      name: '<a href="https://evil.example">Ana</a> & Co',
    });

    expect(injected.html).not.toContain('<a href');
    expect(injected.html).toContain(
      '&lt;a href=&quot;https://evil.example&quot;&gt;Ana&lt;/a&gt; &amp; Co',
    );
  });
});
