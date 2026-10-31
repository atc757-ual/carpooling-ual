// Configuración del envío de SMS (códigos de verificación del teléfono).
// mailpit: en desarrollo, guarda el SMS como un correo a <teléfono>@sms.localhost
//   con cabecera X-Tags: SMS para verlo en http://localhost:8025 sin coste.
// memory: se queda en memoria y no sale de la aplicación (tests).
// El proveedor real queda para el despliegue (ver docs/despliegue.md).
export type SmsTransport = 'mailpit' | 'memory';

export interface SmsConfig {
  transport: SmsTransport;
  // Dominio para el autocompletado WebOTP (@<dominio> #123456); null si está vacío
  otpDomain: string | null;
}

export interface SmsEnvironment {
  NODE_ENV?: string;
  SMS_TRANSPORT?: string;
  SMS_OTP_DOMAIN?: string;
}

const OTP_DOMAIN_PATTERN = /^(localhost|[a-z0-9-]+(\.[a-z0-9-]+)+)$/;

export function parseSmsConfig(env: SmsEnvironment): SmsConfig {
  return {
    transport: parseSmsTransport(env.SMS_TRANSPORT, env.NODE_ENV),
    otpDomain: parseSmsOtpDomain(env.SMS_OTP_DOMAIN),
  };
}

function parseSmsTransport(
  rawTransport: string | undefined,
  nodeEnv: string | undefined,
): SmsTransport {
  if (rawTransport === undefined || rawTransport === '') {
    return nodeEnv === 'test' ? 'memory' : 'mailpit';
  }
  if (rawTransport !== 'mailpit' && rawTransport !== 'memory') {
    throw new Error(
      `Invalid SMS_TRANSPORT "${rawTransport}": expected mailpit or memory`,
    );
  }
  return rawTransport;
}

function parseSmsOtpDomain(rawDomain: string | undefined): string | null {
  const domain = rawDomain?.trim().toLowerCase() ?? '';
  if (domain === '') {
    return null;
  }
  if (!OTP_DOMAIN_PATTERN.test(domain)) {
    throw new Error(
      `Invalid SMS_OTP_DOMAIN "${rawDomain}": expected a domain such as carpooling.ual.es or localhost`,
    );
  }
  return domain;
}
