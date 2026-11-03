import { DataSource } from 'typeorm';

// Los tests se ejecutan en paralelo contra la misma base de datos. El de los
// documentos legales publica versiones de prueba y las borra al terminar;
// mientras tanto, quien se registra acepta esas versiones (su aceptación
// apunta a ellas) y el borrado o el registro fallan por la clave foránea.
// Un candado de PostgreSQL (advisory lock) los pone en orden: el test legal lo
// toma en exclusiva mientras su versión está publicada y cada registro de
// prueba, compartido
const LEGAL_VERSIONS_LOCK = 795_800;

export async function withLegalVersionsLock<T>(
  dataSource: DataSource,
  mode: 'shared' | 'exclusive',
  run: () => Promise<T>,
): Promise<T> {
  // El candado es de la conexión: se toma y se suelta en la misma
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  const suffix = mode === 'shared' ? '_shared' : '';
  try {
    await runner.query(`SELECT pg_advisory_lock${suffix}($1)`, [
      LEGAL_VERSIONS_LOCK,
    ]);
    try {
      return await run();
    } finally {
      await runner.query(`SELECT pg_advisory_unlock${suffix}($1)`, [
        LEGAL_VERSIONS_LOCK,
      ]);
    }
  } finally {
    await runner.release();
  }
}
