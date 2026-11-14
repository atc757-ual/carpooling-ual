import { MigrationInterface, QueryRunner } from 'typeorm';

// Compartir el viaje en directo (seguridad del pasajero): un pasajero con la
// plaza aceptada genera un enlace secreto que abre, sin cuenta, alguien de su
// confianza. Solo se guarda la huella (SHA-256) del enlace, nunca el enlace.
// Un único enlace activo por pasajero y viaje: al generar otro, el anterior se
// revoca. Con el viaje o el usuario se borran en cascada
export class AddTripShares1799600000000 implements MigrationInterface {
  name = 'AddTripShares1799600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE trip_shares (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        passenger_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash   char(64) NOT NULL UNIQUE,
        created_at   timestamptz NOT NULL DEFAULT now(),
        revoked_at   timestamptz
      );

      -- Un solo enlace activo por pasajero y viaje
      CREATE UNIQUE INDEX trip_shares_active_idx
        ON trip_shares (trip_id, passenger_id)
        WHERE revoked_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los índices se borran junto con la tabla
    await queryRunner.query(`DROP TABLE trip_shares;`);
  }
}
