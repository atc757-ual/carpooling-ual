import type { SmsMessage } from '../../../shared/sms/sms-sender';

export interface PhoneVerificationCodeSms {
  to: string;
  code: string;
  expiresInMinutes: number;
  otpDomain?: string | null;
}

// SMS con el código de verificación del teléfono.
// Sin tildes a propósito: una sola tilde cambia la codificación del SMS de
// GSM-7 (160 caracteres) a UCS-2 (70 caracteres). Si hay dominio configurado
// (SMS_OTP_DOMAIN), añade la línea final de WebOTP (@<dominio> #123456)
export function buildPhoneVerificationCodeSms({
  to,
  code,
  expiresInMinutes,
  otpDomain,
}: PhoneVerificationCodeSms): SmsMessage {
  const firstLine =
    `Carpooling UAL: tu codigo de verificacion es ${code}. ` +
    `Caduca en ${expiresInMinutes} min. No lo compartas con nadie.`;
  const domain = otpDomain?.trim() ?? '';
  const text =
    domain === '' ? firstLine : `${firstLine}\n\n@${domain} #${code}`;
  return { to, text };
}
