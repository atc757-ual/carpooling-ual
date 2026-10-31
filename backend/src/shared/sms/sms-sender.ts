export interface SmsMessage {
  // Teléfono de destino en formato internacional E.164 (p. ej. +34600123456)
  to: string;
  // Texto del SMS (alfabeto GSM-7, sin tildes, para caber en 160 caracteres)
  text: string;
}

// Envío de SMS. Clase abstracta para que NestJS la use como token de
// inyección: quien envía SMS depende de SmsSender y no sabe si van a Mailpit
// (desarrollo), a memoria (tests) o al proveedor real en el despliegue
export abstract class SmsSender {
  abstract send(message: SmsMessage): Promise<void>;
}

const SPANISH_E164_PATTERN = /^\+34(\d{3})(\d{3})(\d{3})$/;

// "+34600123456" -> "+34 600 123 456" para el asunto legible en Mailpit
export function formatPhoneForDisplay(phone: string): string {
  const match = SPANISH_E164_PATTERN.exec(phone);
  if (match !== null) {
    return `+34 ${match[1]} ${match[2]} ${match[3]}`;
  }
  return phone;
}
