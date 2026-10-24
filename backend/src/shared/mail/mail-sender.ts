// Un correo listo para enviar: siempre en texto y en HTML (cada programa de
// correo muestra el que sabe mostrar)
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Envío de correos. Es una clase abstracta (y no una interfaz) para que NestJS
// pueda usarla como token de inyección: quien envía correos depende de
// MailSender y no sabe si van por SMTP o se quedan en memoria (tests)
export abstract class MailSender {
  abstract send(message: MailMessage): Promise<void>;
}
