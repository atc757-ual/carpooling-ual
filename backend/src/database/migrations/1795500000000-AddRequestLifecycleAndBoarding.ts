import { MigrationInterface, QueryRunner } from 'typeorm';

// Migración para automatizaciones de ciclo de vida y código de recogida:
// - Añade el estado 'expired' a request_status para solicitudes que caducan por falta de respuesta
// - Añade las columnas rejection_reason, board_code y boarded_at a requests
// - Añade tipos de notificación request_expired y passenger_no_show a notification_type
export class AddRequestLifecycleAndBoarding1795500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'expired'`,
    );

    await queryRunner.query(`
      ALTER TABLE requests
        ADD COLUMN IF NOT EXISTS rejection_reason varchar(50) NULL,
        ADD COLUMN IF NOT EXISTS board_code varchar(4) NULL,
        ADD COLUMN IF NOT EXISTS boarded_at timestamptz NULL;
    `);

    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'request_expired'`,
    );

    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'passenger_no_show'`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS requests_trip_status_idx
        ON requests (trip_id, status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS requests_trip_status_idx;
      ALTER TABLE requests
        DROP COLUMN IF EXISTS boarded_at,
        DROP COLUMN IF EXISTS board_code,
        DROP COLUMN IF EXISTS rejection_reason;
    `);
  }
}
