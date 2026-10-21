import { loadConfiguration, parsePort } from '../../src/config/configuration';

describe('parsePort', () => {
  it('returns 3000 when PORT is not set', () => {
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort('')).toBe(3000);
  });

  it('parses a valid port', () => {
    expect(parsePort('8080')).toBe(8080);
  });

  it.each(['abc', '0', '-1', '65536', '3000.5'])(
    'rejects invalid port "%s"',
    (rawPort) => {
      expect(() => parsePort(rawPort)).toThrow(`Invalid PORT "${rawPort}"`);
    },
  );
});

describe('loadConfiguration', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('reads the port from the environment', () => {
    process.env.PORT = '4000';
    expect(loadConfiguration()).toEqual({ port: 4000 });
  });
});
