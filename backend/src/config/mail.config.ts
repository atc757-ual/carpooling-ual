// Configuración del envío de correos (códigos de verificación y, más adelante,
// de recuperación de contraseña). Se valida al arrancar, como el resto.

// smtp: envío real (en desarrollo, a Mailpit: http://localhost:8025).
// memory: se guardan en memoria y no salen de la aplicación (tests)
export type MailTransport = 'smtp' | 'memory';

export interface SmtpSettings {
  host: string;
  port: number;
  // true: conexión cifrada desde el principio (puerto 465). false: se cifra
  // después si el servidor lo permite (STARTTLS, puerto 587) o, con Mailpit,
  // sin cifrar (solo en local)
  secure: boolean;
  // Usuario y contraseña del servidor SMTP; Mailpit no los necesita
  auth: { user: string; pass: string } | null;
}

export interface MailConfig {
  transport: MailTransport;
  // Remitente, p. ej. "Carpooling UAL <no-reply@ual.es>"
  from: string;
  smtp: SmtpSettings;
}

// Variables de entorno que se leen (para poder probar la función sin tocar
// process.env)
export interface MailEnvironment {
  NODE_ENV?: string;
  MAIL_TRANSPORT?: string;
  MAIL_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
}

// Por defecto, el Mailpit de Docker Compose
const DEFAULT_SMTP_HOST = 'localhost';
const DEFAULT_SMTP_PORT = 1025;
const MAX_PORT = 65535;
const DEFAULT_FROM = 'Carpooling UAL <no-reply@carpooling-ual.local>';

// MAIL_TRANSPORT es opcional: con los tests (Jest pone NODE_ENV=test) los
// correos se quedan en memoria, así el CI no necesita un servidor de correo;
// en el resto de casos se envían por SMTP
export function parseMailConfig(env: MailEnvironment): MailConfig {
  return {
    transport: parseTransport(env.MAIL_TRANSPORT, env.NODE_ENV),
    from: env.MAIL_FROM || DEFAULT_FROM,
    smtp: {
      host: env.SMTP_HOST || DEFAULT_SMTP_HOST,
      port: parseSmtpPort(env.SMTP_PORT),
      secure: parseSecure(env.SMTP_SECURE),
      auth: parseAuth(env.SMTP_USER, env.SMTP_PASSWORD),
    },
  };
}

function parseTransport(
  rawTransport: string | undefined,
  nodeEnv: string | undefined,
): MailTransport {
  if (rawTransport === undefined || rawTransport === '') {
    return nodeEnv === 'test' ? 'memory' : 'smtp';
  }
  if (rawTransport !== 'smtp' && rawTransport !== 'memory') {
    throw new Error(
      `Invalid MAIL_TRANSPORT "${rawTransport}": expected smtp or memory`,
    );
  }
  return rawTransport;
}

function parseSmtpPort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort === '') {
    return DEFAULT_SMTP_PORT;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`Invalid SMTP_PORT "${rawPort}": expected 1-${MAX_PORT}`);
  }
  return port;
}

function parseSecure(rawValue: string | undefined): boolean {
  if (rawValue === undefined || rawValue === '') {
    return false;
  }
  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error(
      `Invalid SMTP_SECURE "${rawValue}": expected true or false`,
    );
  }
  return rawValue === 'true';
}

// Los dos o ninguno: con solo uno, el servidor rechazaría todos los envíos y
// es mejor saberlo al arrancar
function parseAuth(
  user: string | undefined,
  password: string | undefined,
): SmtpSettings['auth'] {
  if (!user && !password) {
    return null;
  }
  if (!user || !password) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be set together');
  }
  return { user, pass: password };
}
