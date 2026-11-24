import { DataSource } from 'typeorm';

// Los tests se ejecutan en paralelo contra la misma base de datos, y los
// ajustes de la plataforma son filas compartidas: el test que los cambia los
// toma en exclusiva con un candado de PostgreSQL (advisory lock) y, al
// terminar, los deja como la migración (apagados y sin cambios)
const PLATFORM_SETTINGS_LOCK = 801_800;

export async function withPlatformSettings<T>(
  dataSource: DataSource,
  run: () => Promise<T>,
): Promise<T> {
  // El candado es de la conexión: se toma y se suelta en la misma
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SELECT pg_advisory_lock($1)', [PLATFORM_SETTINGS_LOCK]);
    try {
      return await run();
    } finally {
      await runner.query(
        `UPDATE platform_settings
           SET value = 'false', updated_at = NULL, updated_by = NULL
         WHERE key = 'multi_day_publishing'`,
      );
      await runner.query('SELECT pg_advisory_unlock($1)', [
        PLATFORM_SETTINGS_LOCK,
      ]);
    }
  } finally {
    await runner.release();
  }
}

// Enciende publicar varios días (dentro de withPlatformSettings)
export async function turnOnMultiDayPublishing(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query(
    `UPDATE platform_settings SET value = 'true'
     WHERE key = 'multi_day_publishing'`,
  );
}
