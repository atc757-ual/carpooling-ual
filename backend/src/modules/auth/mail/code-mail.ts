import type { AppLanguage } from '../../../shared/i18n/app-language';
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
// eliminar la cuenta
export type CodePurpose = 'verification' | 'passwordReset' | 'accountDeletion';

interface CodeTexts {
  subject: string;
  intro: string;
  // Por qué ignorarlo si no lo pidió
  ignore: string;
}

interface LanguageTexts {
  greeting: (name: string) => string;
  expires: (minutes: number) => string;
  purposes: Record<CodePurpose, CodeTexts>;
}

const TEXTS: Record<AppLanguage, LanguageTexts> = {
  es: {
    greeting: (name) => `Hola, ${name}:`,
    expires: (minutes) => `Caduca en ${minutes} minutos.`,
    purposes: {
      verification: {
        subject: 'Tu código de verificación de Carpooling UAL',
        intro: 'Tu código para verificar el correo en Carpooling UAL es:',
        ignore:
          'Si no te has registrado tú, ignora este correo: nadie podrá usar tu dirección sin este código.',
      },
      passwordReset: {
        subject: 'Tu código para cambiar la contraseña de Carpooling UAL',
        intro: 'Tu código para cambiar la contraseña en Carpooling UAL es:',
        ignore:
          'Si no lo has pedido tú, ignora este correo: tu contraseña no cambiará sin este código.',
      },
      accountDeletion: {
        subject: 'Tu código para eliminar la cuenta de Carpooling UAL',
        intro:
          'Tu código para confirmar la eliminación de tu cuenta en Carpooling UAL es:',
        ignore:
          'Si no lo has pedido tú, ignora este correo: tu cuenta no se eliminará sin este código.',
      },
    },
  },
  en: {
    greeting: (name) => `Hi ${name},`,
    expires: (minutes) => `It expires in ${minutes} minutes.`,
    purposes: {
      verification: {
        subject: 'Your Carpooling UAL verification code',
        intro: 'Your code to verify your email in Carpooling UAL is:',
        ignore:
          'If you did not sign up, ignore this email: nobody can use your address without this code.',
      },
      passwordReset: {
        subject: 'Your code to change your Carpooling UAL password',
        intro: 'Your code to change your password in Carpooling UAL is:',
        ignore:
          'If you did not ask for it, ignore this email: your password will not change without this code.',
      },
      accountDeletion: {
        subject: 'Your code to delete your Carpooling UAL account',
        intro:
          'Your code to confirm the deletion of your Carpooling UAL account is:',
        ignore:
          'If you did not ask for it, ignore this email: your account will not be deleted without this code.',
      },
    },
  },
};

// Correo con un código de 6 cifras, en el idioma del usuario. HTML sencillo
// con estilos en línea (los programas de correo ignoran las hojas de estilo)
// y sin imágenes externas (muchos las bloquean y sirven para rastrear al
// lector)
export function buildCodeMail(
  purpose: CodePurpose,
  { to, name, code, expiresInMinutes, language }: CodeMail,
): MailMessage {
  const texts = TEXTS[language];
  const { subject, intro, ignore } = texts.purposes[purpose];
  const expires = texts.expires(expiresInMinutes);
  const text = [
    texts.greeting(name),
    '',
    intro,
    '',
    `    ${code}`,
    '',
    expires,
    '',
    ignore,
  ].join('\n');
  // El nombre lo escribe el usuario: se escapa para que no pueda meter HTML
  const html = `<div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 480px">
  <p>${escapeHtml(texts.greeting(name))}</p>
  <p>${intro}</p>
  <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0">${code}</p>
  <p>${expires}</p>
  <p style="color: #5c5c5c; font-size: 14px">${ignore}</p>
</div>`;
  return { to, subject, text, html };
}
