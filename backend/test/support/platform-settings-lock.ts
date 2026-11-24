import { DataSource } from 'typeorm';

// Los tests se ejecutan en paralelo contra la misma base de datos, y los
// ajustes de la plataforma son filas compartidas: el test que los cambia los
// toma en exclusiva con un candado de PostgreSQL (advisory lock) en su
// beforeEach y los suelta en su afterEach, que los deja como la migración
// (apagados y sin cambios)
const PLATFORM_SETTINGS_LOCK = 801_800;

// Toma el candado y devuelve cómo soltarlo
export async function lockPlatformSettings(
  dataSource: DataSource,
): Promise<() => Promise<void>> {
  // El candado es de la conexión: se toma y se suelta en la misma
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.query('SELECT pg_advisory_lock($1)', [PLATFORM_SETTINGS_LOCK]);
  return async () => {
    try {
      await runner.query(
        `UPDATE platform_settings
           SET value = 'false', updated_at = NULL, updated_by = NULL
         WHERE key = 'multi_day_publishing'`,
      );
      await runner.query('SELECT pg_advisory_unlock($1)', [
        PLATFORM_SETTINGS_LOCK,
      ]);
    } finally {
      await runner.release();
    }
  };
}

// Enciende o apaga publicar varios días (con el candado tomado)
export async function setMultiDayPublishing(
  dataSource: DataSource,
  isOn: boolean,
): Promise<void> {
  await dataSource.query(
    `UPDATE platform_settings SET value = $1::jsonb
     WHERE key = 'multi_day_publishing'`,
    [JSON.stringify(isOn)],
  );
}
