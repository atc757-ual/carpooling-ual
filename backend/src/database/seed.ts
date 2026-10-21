import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import dataSource from './data-source';

// Carga los datos de prueba (seeds/dev-seed.sql) con: npm run seed
// Se ejecuta fuera de NestJS, como las migraciones, y usa la misma conexión
// (data-source.ts). Requiere el esquema creado antes con: npm run migrate
const SEED_FILE = join(__dirname, 'seeds', 'dev-seed.sql');

async function runSeed(): Promise<void> {
  await dataSource.initialize();
  try {
    // El seed usa ids fijos: ejecutarlo dos veces fallaría por claves
    // duplicadas, así que solo se permite sobre una base de datos sin usuarios
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM users',
    );
    if (Number(count) > 0) {
      throw new Error(
        'The database already has users. To reload the seed, reset it first: ' +
          'npm run migration:revert && npm run migrate && npm run seed',
      );
    }

    // En una transacción: si falla una sola inserción, no se guarda nada
    const seedSql = readFileSync(SEED_FILE, 'utf8');
    await dataSource.transaction((manager) => manager.query(seedSql));
    process.stdout.write('Seed loaded: dev-seed.sql\n');
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${String(error)}\n`);
  process.exitCode = 1;
});
