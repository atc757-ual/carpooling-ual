import { MigrationInterface, QueryRunner } from 'typeorm';

// Cierre por pasajero («modo retorno»): cada plaza termina por su cuenta
// - request_status: completed (el pasajero se ha bajado), terminal
// - requests.dropped_off_at y dropped_off_by: cuándo y quién marcó la bajada
//   (driver, passenger o system)
// - notification_type: trip_completed («Tu viaje ha terminado», al pasajero,
//   con su solicitud)
export class AddRequestDropOff1800200000000 implements MigrationInterface {
  name = 'AddRequestDropOff1800200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'completed'`,
    );
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trip_completed'`,
    );
    await queryRunner.query(`
      ALTER TABLE requests
        ADD COLUMN dropped_off_at timestamptz NULL,
        ADD COLUMN dropped_off_by varchar(16) NULL,
        ADD CONSTRAINT requests_dropped_off_by_check
          CHECK (dropped_off_by IN ('driver', 'passenger', 'system'))
    `);
  }

  // Los valores nuevos de los tipos se quedan (PostgreSQL no permite
  // quitarlos): las plazas cerradas vuelven a contar como aceptadas
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE requests SET status = 'accepted' WHERE status::text = 'completed'`,
    );
    await queryRunner.query(
      `DELETE FROM notifications WHERE type::text = 'trip_completed'`,
    );
    await queryRunner.query(`
      ALTER TABLE requests
        DROP CONSTRAINT requests_dropped_off_by_check,
        DROP COLUMN dropped_off_by,
        DROP COLUMN dropped_off_at
    `);
  }
}
