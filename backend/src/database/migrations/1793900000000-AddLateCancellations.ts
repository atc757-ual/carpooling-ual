import { MigrationInterface, QueryRunner } from 'typeorm';

// Cancelaciones tardías: el conductor que cancela un viaje con pasajeros
// aceptados a menos de 30 minutos de la salida (y, más adelante, el pasajero
// que suelta su plaza a menos de 10). Se guarda cada una con su fecha para
// contar las de los últimos 30 días: con 3, el conductor no puede publicar en
// 7 días. Al borrar el usuario o el viaje, sus registros se borran en cascada
export class AddLateCancellations1793900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE late_cancellations (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        role         varchar(10) NOT NULL
                     CONSTRAINT late_cancellations_role_check
                     CHECK (role IN ('driver', 'passenger')),
        cancelled_at timestamptz NOT NULL DEFAULT now()
      );

      -- Las de un usuario en un papel, de la más reciente a la más antigua
      CREATE INDEX late_cancellations_user_idx
        ON late_cancellations (user_id, role, cancelled_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE late_cancellations`);
  }
}
