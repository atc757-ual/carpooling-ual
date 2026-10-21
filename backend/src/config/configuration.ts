export interface AppConfig {
  port: number;
}

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;

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

export function loadConfiguration(): AppConfig {
  return {
    port: parsePort(process.env.PORT),
  };
}
