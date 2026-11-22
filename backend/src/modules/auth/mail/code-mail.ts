import type { AppLanguage } from '../../../shared/i18n/app-language';
import { translate } from '../../../shared/i18n/translate';
import { escapeHtml } from '../../../shared/mail/escape-html';
import type { MailMessage } from '../../../shared/mail/mail-sender';

export interface CodeMail {
  to: string;
  name: string;
  code: string;
  expiresInMinutes: number;
  // El idioma del usuario (el de la app al registrarse o el de su cuenta)
  language: AppLanguage;
}

// Para qué es el código: verificar el correo, cambiar la contraseña o
// eliminar la cuenta (sus textos, en mail.code.<para qué> de src/i18n)
export type CodePurpose = 'verification' | 'passwordReset' | 'accountDeletion';

// Correo con un código de 6 cifras, en el idioma del usuario. HTML sencillo
// con estilos en línea (los programas de correo ignoran las hojas de estilo)
// y sin imágenes externas (muchos las bloquean y sirven para rastrear al
// lector)
export function buildCodeMail(
  purpose: CodePurpose,
  { to, name, code, expiresInMinutes, language }: CodeMail,
): MailMessage {
  const t = (key: string) => translate(language, `mail.code.${purpose}.${key}`);
  const greeting = translate(language, 'mail.greeting', { name });
  const expires = translate(language, 'mail.code.expires', {
    minutes: expiresInMinutes,
  });
  const text = [
    greeting,
    '',
    t('intro'),
    '',
    `    ${code}`,
    '',
    expires,
    '',
    t('ignore'),
  ].join('\n');
  // El nombre lo escribe el usuario: se escapa para que no pueda meter HTML
  const html = `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  <p>${escapeHtml(greeting)}</p>
  <p>${t('intro')}</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${code}</p>
  <p>${expires}</p>
  <p style="color: #5c5c5c; font-size: 14px">${t('ignore')}</p>
</div>`;
  return { to, subject: t('subject'), text, html };
}
