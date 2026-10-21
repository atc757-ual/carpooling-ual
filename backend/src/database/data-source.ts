import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { parseDatabaseUrl } from '../config/configuration';

// Configuración que usa la CLI de TypeORM (npm run migrate, etc.).
// La CLI se ejecuta fuera de NestJS, así que no pasa por ConfigModule:
// carga ella misma el .env (primero backend/.env y, si no existe, el de la raíz).
// En el CI no hay .env: DATABASE_URL llega como variable de entorno.
const ENV_FILES = [
  join(__dirname, '..', '..', '.env'),
  join(__dirname, '..', '..', '..', '.env'),
];
const envFile = ENV_FILES.find((file) => existsSync(file));
if (process.env.DATABASE_URL === undefined && envFile !== undefined) {
  process.loadEnvFile(envFile);
}

export default new DataSource({
  type: 'postgres',
  // Misma validación que usa la app al arrancar (paso 2)
  url: parseDatabaseUrl(process.env.DATABASE_URL),
  // Entidades (*.entity.ts) de todos los módulos, para poder generar migraciones
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
