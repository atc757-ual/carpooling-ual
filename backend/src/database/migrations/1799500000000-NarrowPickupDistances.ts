import { MigrationInterface, QueryRunner } from 'typeorm';

// Recogida en ruta: apartarse 1 km para recoger a alguien es demasiado
// (decidido con el autor el 14/11/2026). Los metros pasan a 150, 300 o 500,
// con 300 por defecto; los viajes que tenían 1000 se quedan en 500, el máximo
export class NarrowPickupDistances1799500000000 implements MigrationInterface {
  name = 'NarrowPickupDistances1799500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE trips DROP CONSTRAINT trips_max_detour_m_check`,
    );
    await queryRunner.query(
      `UPDATE trips SET max_detour_m = 500 WHERE max_detour_m = 1000`,
    );
    await queryRunner.query(`
      ALTER TABLE trips
        ALTER COLUMN max_detour_m SET DEFAULT 300,
        ADD CONSTRAINT trips_max_detour_m_check
          CHECK (max_detour_m IS NULL OR max_detour_m IN (150, 300, 500))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE trips DROP CONSTRAINT trips_max_detour_m_check`,
    );
    await queryRunner.query(
      `UPDATE trips SET max_detour_m = 300 WHERE max_detour_m = 150`,
    );
    await queryRunner.query(`
      ALTER TABLE trips
        ALTER COLUMN max_detour_m SET DEFAULT 500,
        ADD CONSTRAINT trips_max_detour_m_check
          CHECK (max_detour_m IS NULL OR max_detour_m IN (300, 500, 1000))
    `);
  }
}
