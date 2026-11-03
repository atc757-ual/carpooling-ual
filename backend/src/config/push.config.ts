// Configuración de las notificaciones push (Firebase Cloud Messaging).
// fcm: envío real con la cuenta de servicio de Firebase (un JSON secreto,
//   fuera del repositorio: FIREBASE_SERVICE_ACCOUNT_PATH).
// memory: se guardan en memoria y no salen de la aplicación (tests).
// disabled: sin cuenta de servicio no se envía nada (y nada falla): los
//   avisos siguen llegando dentro de la app
export type PushTransport = 'fcm' | 'memory' | 'disabled';

export interface PushConfig {
  transport: PushTransport;
  // Ruta del JSON de la cuenta de servicio; null salvo con fcm
  serviceAccountPath: string | null;
}

export interface PushEnvironment {
  NODE_ENV?: string;
  PUSH_TRANSPORT?: string;
  FIREBASE_SERVICE_ACCOUNT_PATH?: string;
}

const TRANSPORTS: ReadonlySet<string> = new Set(['fcm', 'memory', 'disabled']);

// PUSH_TRANSPORT es opcional: en los tests, en memoria; si no, fcm con la
// cuenta de servicio o, sin ella, desactivado
export function parsePushConfig(env: PushEnvironment): PushConfig {
  const path = env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || null;
  const transport = parseTransport(env.PUSH_TRANSPORT, env.NODE_ENV, path);
  if (transport === 'fcm' && path === null) {
    throw new Error('PUSH_TRANSPORT=fcm needs FIREBASE_SERVICE_ACCOUNT_PATH');
  }
  return { transport, serviceAccountPath: transport === 'fcm' ? path : null };
}

function parseTransport(
  rawTransport: string | undefined,
  nodeEnv: string | undefined,
  path: string | null,
): PushTransport {
  if (rawTransport === undefined || rawTransport === '') {
    if (nodeEnv === 'test') {
      return 'memory';
    }
    return path === null ? 'disabled' : 'fcm';
  }
  if (!TRANSPORTS.has(rawTransport)) {
    throw new Error(
      `Invalid PUSH_TRANSPORT "${rawTransport}": expected fcm, memory or disabled`,
    );
  }
  return rawTransport as PushTransport;
}
