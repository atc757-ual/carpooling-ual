// Lectura y validación de las variables de entorno (.env).
// Las variables siempre llegan como texto: aquí se convierten al tipo correcto
// y se validan al arrancar, para que un valor erróneo falle con un mensaje claro
// en lugar de provocar errores confusos más tarde.

// Forma de la configuración que usa el resto de la aplicación
// (se lee con ConfigService, p. ej. configService.get('port')).
export interface AppConfig {
  port: number;
  databaseUrl: string;
}

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;
const POSTGRES_PROTOCOLS = ['postgres:', 'postgresql:'];

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

// La llama ConfigModule (en app.module.ts) una vez al arrancar.
export function loadConfiguration(): AppConfig {
  return {
    port: parsePort(process.env.PORT),
    databaseUrl: parseDatabaseUrl(process.env.DATABASE_URL),
  };
}
