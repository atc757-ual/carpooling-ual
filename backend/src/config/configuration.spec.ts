import {
  loadConfiguration,
  parseDatabaseUrl,
  parsePort,
} from './configuration';

const DEV_DATABASE_URL =
  'postgresql://carpooling:carpooling_dev@localhost:5432/carpooling';

describe('parsePort', () => {
  it('returns 3000 when PORT is not set', () => {
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort('')).toBe(3000);
  });

  it('parses a valid port', () => {
    expect(parsePort('8080')).toBe(8080);
  });

  // it.each repite el mismo test con cada valor de la lista
  it.each(['abc', '0', '-1', '65536', '3000.5'])(
    'rejects invalid port "%s"',
    (rawPort) => {
      expect(() => parsePort(rawPort)).toThrow(`Invalid PORT "${rawPort}"`);
    },
  );
});

describe('parseDatabaseUrl', () => {
  it.each([undefined, ''])('requires DATABASE_URL (%p)', (rawUrl) => {
    expect(() => parseDatabaseUrl(rawUrl)).toThrow('DATABASE_URL is required');
  });

  it.each(['postgresql://u:p@localhost:5432/db', 'postgres://u:p@db:5432/db'])(
    'accepts the PostgreSQL URL "%s"',
    (rawUrl) => {
      expect(parseDatabaseUrl(rawUrl)).toBe(rawUrl);
    },
  );

  it.each(['mysql://u:p@localhost:3306/db', 'not a url', 'localhost:5432'])(
    'rejects the non-PostgreSQL value "%s"',
    (rawUrl) => {
      expect(() => parseDatabaseUrl(rawUrl)).toThrow('Invalid DATABASE_URL');
    },
  );
});

describe('loadConfiguration', () => {
  // Se guardan las variables reales para restaurarlas tras cada test,
  // de modo que un test no afecte a los demás
  const originalPort = process.env.PORT;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    restoreEnv('PORT', originalPort);
    restoreEnv('DATABASE_URL', originalDatabaseUrl);
  });

  it('reads the port and the database URL from the environment', () => {
    process.env.PORT = '4000';
    process.env.DATABASE_URL = DEV_DATABASE_URL;

    expect(loadConfiguration()).toEqual({
      port: 4000,
      databaseUrl: DEV_DATABASE_URL,
    });
  });

  it('fails at startup when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    expect(() => loadConfiguration()).toThrow('DATABASE_URL is required');
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
