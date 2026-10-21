import {
  loadConfiguration,
  parseAccessTokenTtl,
  parseApiDocsEnabled,
  parseDatabaseUrl,
  parseEmailDomains,
  parseJwtSecret,
  parsePort,
  parseSessionLifetime,
} from './configuration';

const DEV_DATABASE_URL =
  'postgresql://carpooling:carpooling_dev@localhost:5432/carpooling';
const DEV_JWT_SECRET = 'test-only-secret-with-at-least-32-chars';

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

describe('parseJwtSecret', () => {
  it.each([undefined, ''])('requires JWT_SECRET (%p)', (rawSecret) => {
    expect(() => parseJwtSecret(rawSecret)).toThrow('JWT_SECRET is required');
  });

  it('rejects a secret shorter than 32 characters', () => {
    expect(() => parseJwtSecret('short-secret')).toThrow(
      'JWT_SECRET is too short',
    );
  });

  it('accepts a secret of 32 characters or more', () => {
    expect(parseJwtSecret(DEV_JWT_SECRET)).toBe(DEV_JWT_SECRET);
  });
});

describe('parseAccessTokenTtl', () => {
  it('returns 15 minutes when JWT_ACCESS_TTL_MINUTES is not set', () => {
    expect(parseAccessTokenTtl(undefined)).toBe(15);
    expect(parseAccessTokenTtl('')).toBe(15);
  });

  it('parses a valid number of minutes', () => {
    expect(parseAccessTokenTtl('30')).toBe(30);
  });

  it.each(['abc', '0', '-5', '1441', '7.5'])(
    'rejects the invalid duration "%s"',
    (rawMinutes) => {
      expect(() => parseAccessTokenTtl(rawMinutes)).toThrow(
        'Invalid JWT_ACCESS_TTL_MINUTES',
      );
    },
  );
});

describe('parseSessionLifetime', () => {
  it('uses 7 days (sliding) and 30 days (maximum) by default', () => {
    expect(parseSessionLifetime(undefined, '')).toEqual({
      refreshTtlDays: 7,
      sessionMaxDays: 30,
    });
  });

  it('parses valid values, also with both durations equal', () => {
    expect(parseSessionLifetime('14', '60')).toEqual({
      refreshTtlDays: 14,
      sessionMaxDays: 60,
    });
    expect(parseSessionLifetime('30', '30')).toEqual({
      refreshTtlDays: 30,
      sessionMaxDays: 30,
    });
  });

  it.each(['abc', '0', '91', '1.5'])(
    'rejects the invalid JWT_REFRESH_TTL_DAYS "%s"',
    (rawDays) => {
      expect(() => parseSessionLifetime(rawDays, '90')).toThrow(
        'Invalid JWT_REFRESH_TTL_DAYS',
      );
    },
  );

  it.each(['abc', '0', '366'])(
    'rejects the invalid JWT_SESSION_MAX_DAYS "%s"',
    (rawDays) => {
      expect(() => parseSessionLifetime('7', rawDays)).toThrow(
        'Invalid JWT_SESSION_MAX_DAYS',
      );
    },
  );

  it('rejects a maximum shorter than the sliding duration', () => {
    expect(() => parseSessionLifetime('10', '5')).toThrow(
      'must be at least JWT_REFRESH_TTL_DAYS (10)',
    );
  });
});

describe('parseEmailDomains', () => {
  it('allows the UAL domains by default', () => {
    expect(parseEmailDomains(undefined)).toEqual(['ual.es', 'inlumine.ual.es']);
  });

  it('normalizes a custom list (spaces and capital letters)', () => {
    expect(parseEmailDomains(' UAL.es , Other.Example.org ')).toEqual([
      'ual.es',
      'other.example.org',
    ]);
  });

  it.each(['ual', 'ual.es,@inlumine', ',,', 'ual es'])(
    'rejects the invalid list "%s"',
    (rawDomains) => {
      expect(() => parseEmailDomains(rawDomains)).toThrow(
        'Invalid ALLOWED_EMAIL_DOMAINS',
      );
    },
  );
});

describe('parseApiDocsEnabled', () => {
  it('publishes the API docs by default', () => {
    expect(parseApiDocsEnabled(undefined)).toBe(true);
    expect(parseApiDocsEnabled('')).toBe(true);
  });

  it('reads true and false', () => {
    expect(parseApiDocsEnabled('true')).toBe(true);
    expect(parseApiDocsEnabled('false')).toBe(false);
  });

  it.each(['yes', '0', 'FALSE'])('rejects the invalid value "%s"', (raw) => {
    expect(() => parseApiDocsEnabled(raw)).toThrow('Invalid API_DOCS_ENABLED');
  });
});

describe('loadConfiguration', () => {
  // Se guardan las variables reales para restaurarlas tras cada test,
  // de modo que un test no afecte a los demás
  const ENV_KEYS = [
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_ACCESS_TTL_MINUTES',
    'JWT_REFRESH_TTL_DAYS',
    'JWT_SESSION_MAX_DAYS',
    'ALLOWED_EMAIL_DOMAINS',
    'API_DOCS_ENABLED',
  ];
  const originalEnv = ENV_KEYS.map((key) => [key, process.env[key]] as const);

  beforeEach(() => {
    process.env.DATABASE_URL = DEV_DATABASE_URL;
    process.env.JWT_SECRET = DEV_JWT_SECRET;
  });

  afterEach(() => {
    originalEnv.forEach(([key, value]) => restoreEnv(key, value));
  });

  it('reads the whole configuration from the environment', () => {
    process.env.PORT = '4000';
    process.env.JWT_ACCESS_TTL_MINUTES = '20';
    process.env.JWT_REFRESH_TTL_DAYS = '10';
    process.env.JWT_SESSION_MAX_DAYS = '40';
    process.env.ALLOWED_EMAIL_DOMAINS = 'ual.es';
    process.env.API_DOCS_ENABLED = 'false';

    expect(loadConfiguration()).toEqual({
      port: 4000,
      databaseUrl: DEV_DATABASE_URL,
      jwt: {
        secret: DEV_JWT_SECRET,
        accessTtlMinutes: 20,
        refreshTtlDays: 10,
        sessionMaxDays: 40,
      },
      allowedEmailDomains: ['ual.es'],
      apiDocsEnabled: false,
    });
  });

  it('fails at startup when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => loadConfiguration()).toThrow('JWT_SECRET is required');
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
