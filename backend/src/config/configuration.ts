// Lectura y validación de las variables de entorno (.env).
// Las variables siempre llegan como texto: aquí se convierten al tipo correcto
// y se validan al arrancar, para que un valor erróneo falle con un mensaje claro
// en lugar de provocar errores confusos más tarde.

// Forma de la configuración que usa el resto de la aplicación
// (se lee con ConfigService, p. ej. configService.get('port')).
export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwt: { secret: string; accessTtlMinutes: number };
  allowedEmailDomains: string[];
}

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;
const POSTGRES_PROTOCOLS = ['postgres:', 'postgresql:'];
const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_ACCESS_TTL_MINUTES = 15;
const MAX_ACCESS_TTL_MINUTES = 24 * 60;
const DEFAULT_EMAIL_DOMAINS = 'ual.es,inlumine.ual.es';
// Al menos dos partes separadas por puntos: "ual.es", "inlumine.ual.es"
const DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// PORT es opcional: si no se indica, se usa el 3000.
export function parsePort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort === '') {
    return DEFAULT_PORT;
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`Invalid PORT "${rawPort}": expected 1-${MAX_PORT}`);
  }
  return port;
}

// DATABASE_URL es obligatoria y no tiene valor por defecto: así el backend nunca
// se conecta en silencio a una base de datos equivocada ni hay credenciales en
// el código. Formato: postgresql://usuario:contraseña@servidor:puerto/base_de_datos
export function parseDatabaseUrl(rawUrl: string | undefined): string {
  if (rawUrl === undefined || rawUrl === '') {
    throw new Error('DATABASE_URL is required');
  }

  // URL.canParse evita que new URL() lance su propio error con textos que no son URL
  const url = URL.canParse(rawUrl) ? new URL(rawUrl) : undefined;
  if (url === undefined || !POSTGRES_PROTOCOLS.includes(url.protocol)) {
    throw new Error(
      'Invalid DATABASE_URL: expected postgresql://user:password@host:port/database',
    );
  }
  return rawUrl;
}

// JWT_SECRET es la llave con la que se firman los tokens: quien la conozca
// puede fabricar tokens válidos. Es obligatoria (nunca hay una llave conocida
// escrita en el código) y debe ser larga para que no se pueda adivinar.
export function parseJwtSecret(rawSecret: string | undefined): string {
  if (rawSecret === undefined || rawSecret === '') {
    throw new Error('JWT_SECRET is required');
  }
  if (rawSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is too short: expected at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }
  return rawSecret;
}

// Duración del token de acceso en minutos (por defecto 15). Es corta a
// propósito: la sesión se mantiene con el token de renovación.
export function parseAccessTokenTtl(rawMinutes: string | undefined): number {
  if (rawMinutes === undefined || rawMinutes === '') {
    return DEFAULT_ACCESS_TTL_MINUTES;
  }

  const minutes = Number(rawMinutes);
  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > MAX_ACCESS_TTL_MINUTES
  ) {
    throw new Error(
      `Invalid JWT_ACCESS_TTL_MINUTES "${rawMinutes}": expected 1-${MAX_ACCESS_TTL_MINUTES}`,
    );
  }
  return minutes;
}

// Dominios de correo con los que se permite registrarse (separados por comas).
// Por defecto, los de la UAL: personal (ual.es) y estudiantes (inlumine.ual.es).
export function parseEmailDomains(rawDomains: string | undefined): string[] {
  const domains = (rawDomains || DEFAULT_EMAIL_DOMAINS)
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain !== '');

  const invalidDomain = domains.find((domain) => !DOMAIN_PATTERN.test(domain));
  if (domains.length === 0 || invalidDomain !== undefined) {
    throw new Error(
      `Invalid ALLOWED_EMAIL_DOMAINS "${rawDomains}": expected e.g. ual.es,inlumine.ual.es`,
    );
  }
  return domains;
}

// La llama ConfigModule (en app.module.ts) una vez al arrancar.
export function loadConfiguration(): AppConfig {
  return {
    port: parsePort(process.env.PORT),
    databaseUrl: parseDatabaseUrl(process.env.DATABASE_URL),
    jwt: {
      secret: parseJwtSecret(process.env.JWT_SECRET),
      accessTtlMinutes: parseAccessTokenTtl(process.env.JWT_ACCESS_TTL_MINUTES),
    },
    allowedEmailDomains: parseEmailDomains(process.env.ALLOWED_EMAIL_DOMAINS),
  };
}
