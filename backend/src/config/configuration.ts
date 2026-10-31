// Lectura y validación de las variables de entorno (.env).
// Las variables siempre llegan como texto: aquí se convierten al tipo correcto
// y se validan al arrancar, para que un valor erróneo falle con un mensaje claro
// en lugar de provocar errores confusos más tarde.

import { MailConfig, parseMailConfig } from './mail.config';
import { parseSmsConfig, SmsConfig } from './sms.config';

// Forma de la configuración que usa el resto de la aplicación
// (se lee con ConfigService, p. ej. configService.get('port')).
export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwt: { secret: string; accessTtlMinutes: number } & SessionLifetime;
  allowedEmailDomains: string[];
  apiDocsEnabled: boolean;
  osrmUrl: string;
  positionMinIntervalSeconds: number;
  mail: MailConfig;
  sms: SmsConfig;
}

// Duración de la sesión (token de renovación), en días
export interface SessionLifetime {
  refreshTtlDays: number;
  sessionMaxDays: number;
}

// Variable de entorno numérica: entero entre 1 y max, con valor por defecto
interface IntegerSetting {
  name: string;
  defaultValue: number;
  max: number;
}

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const MIN_JWT_SECRET_LENGTH = 32;
const ACCESS_TTL_MINUTES: IntegerSetting = {
  name: 'JWT_ACCESS_TTL_MINUTES',
  defaultValue: 15,
  max: 24 * 60,
};
const REFRESH_TTL_DAYS: IntegerSetting = {
  name: 'JWT_REFRESH_TTL_DAYS',
  defaultValue: 7,
  max: 90,
};
const SESSION_MAX_DAYS: IntegerSetting = {
  name: 'JWT_SESSION_MAX_DAYS',
  defaultValue: 30,
  max: 365,
};
const POSITION_MIN_INTERVAL_SECONDS: IntegerSetting = {
  name: 'POSITION_MIN_INTERVAL_SECONDS',
  defaultValue: 10,
  max: 300,
};
const DEFAULT_EMAIL_DOMAINS = 'ual.es,inlumine.ual.es';
const DEFAULT_OSRM_URL = 'http://localhost:5000';
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
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
// el código. Formato: postgresql://<usuario>:<contraseña>@<servidor>:<puerto>/<base_de_datos>
export function parseDatabaseUrl(rawUrl: string | undefined): string {
  if (rawUrl === undefined || rawUrl === '') {
    throw new Error('DATABASE_URL is required');
  }

  // URL.canParse evita que new URL() lance su propio error con textos que no son URL
  const url = URL.canParse(rawUrl) ? new URL(rawUrl) : undefined;
  if (url === undefined || !POSTGRES_PROTOCOLS.has(url.protocol)) {
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
  return parseIntegerSetting(rawMinutes, ACCESS_TTL_MINUTES);
}

// Duración de la sesión, deslizante y con tope:
// - JWT_REFRESH_TTL_DAYS (por defecto 7): cada renovación da estos días más;
//   si no se usa la app en ese tiempo, hay que volver a iniciar sesión.
// - JWT_SESSION_MAX_DAYS (por defecto 30): máximo desde el login, aunque se
//   use a diario; así un token robado no se puede mantener vivo para siempre.
export function parseSessionLifetime(
  rawRefreshDays: string | undefined,
  rawMaxDays: string | undefined,
): SessionLifetime {
  const refreshTtlDays = parseIntegerSetting(rawRefreshDays, REFRESH_TTL_DAYS);
  const sessionMaxDays = parseIntegerSetting(rawMaxDays, SESSION_MAX_DAYS);
  if (sessionMaxDays < refreshTtlDays) {
    throw new Error(
      `Invalid JWT_SESSION_MAX_DAYS "${rawMaxDays}": must be at least JWT_REFRESH_TTL_DAYS (${refreshTtlDays})`,
    );
  }
  return { refreshTtlDays, sessionMaxDays };
}

function parseIntegerSetting(
  rawValue: string | undefined,
  setting: IntegerSetting,
): number {
  if (rawValue === undefined || rawValue === '') {
    return setting.defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > setting.max) {
    throw new Error(
      `Invalid ${setting.name} "${rawValue}": expected 1-${setting.max}`,
    );
  }
  return value;
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

// API_DOCS_ENABLED: publica la documentación interactiva (Swagger UI) en
// /api/docs. Activada por defecto; se puede apagar en producción con "false"
export function parseApiDocsEnabled(rawValue: string | undefined): boolean {
  if (rawValue === undefined || rawValue === '') {
    return true;
  }
  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new Error(
      `Invalid API_DOCS_ENABLED "${rawValue}": expected true or false`,
    );
  }
  return rawValue === 'true';
}

// OSRM_URL: dirección del motor de rutas OSRM (DP-02). Por defecto, el de
// Docker Compose en local. Si no responde, el backend estima las rutas
export function parseOsrmUrl(rawUrl: string | undefined): string {
  if (rawUrl === undefined || rawUrl === '') {
    return DEFAULT_OSRM_URL;
  }
  const url = URL.canParse(rawUrl) ? new URL(rawUrl) : undefined;
  if (url === undefined || !HTTP_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `Invalid OSRM_URL "${rawUrl}": expected e.g. http://localhost:5000`,
    );
  }
  return rawUrl;
}

// POSITION_MIN_INTERVAL_SECONDS (por defecto 10): segundos mínimos entre dos
// posiciones del conductor durante el viaje. Fija la frecuencia con la que se
// actualiza el Gemelo Digital (DP-04, aún abierta: por eso es configurable)
export function parsePositionMinInterval(
  rawSeconds: string | undefined,
): number {
  return parseIntegerSetting(rawSeconds, POSITION_MIN_INTERVAL_SECONDS);
}

// La llama ConfigModule (en app.module.ts) una vez al arrancar.
export function loadConfiguration(): AppConfig {
  return {
    port: parsePort(process.env.PORT),
    databaseUrl: parseDatabaseUrl(process.env.DATABASE_URL),
    jwt: {
      secret: parseJwtSecret(process.env.JWT_SECRET),
      accessTtlMinutes: parseAccessTokenTtl(process.env.JWT_ACCESS_TTL_MINUTES),
      ...parseSessionLifetime(
        process.env.JWT_REFRESH_TTL_DAYS,
        process.env.JWT_SESSION_MAX_DAYS,
      ),
    },
    allowedEmailDomains: parseEmailDomains(process.env.ALLOWED_EMAIL_DOMAINS),
    apiDocsEnabled: parseApiDocsEnabled(process.env.API_DOCS_ENABLED),
    osrmUrl: parseOsrmUrl(process.env.OSRM_URL),
    positionMinIntervalSeconds: parsePositionMinInterval(
      process.env.POSITION_MIN_INTERVAL_SECONDS,
    ),
    mail: parseMailConfig(process.env),
    sms: parseSmsConfig(process.env),
  };
}
