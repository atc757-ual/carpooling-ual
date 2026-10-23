import { MigrationInterface, QueryRunner } from 'typeorm';

// Seguimiento real del viaje (RF-12: "estado actual del desplazamiento"). Las
// posiciones que envía el conductor mientras el viaje está en curso, cada una
// con lo que queda hasta el destino (calculado con OSRM, o estimado si no
// responde). Privacidad (RGPD, minimización): son la ubicación de una persona,
// así que solo se guardan durante el viaje; al finalizar o cancelarlo se
// borran (lo hace el backend). Con el viaje se borran en cascada
export class AddTripPositions1792713711769 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE trip_positions (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id          uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        position         geography(Point, 4326) NOT NULL,
        remaining_km     numeric(7, 2) NOT NULL CHECK (remaining_km >= 0),
        remaining_min    integer NOT NULL CHECK (remaining_min >= 0),
        remaining_source route_source NOT NULL,
        recorded_at      timestamptz NOT NULL DEFAULT now()
      );

      -- La última posición de un viaje
      CREATE INDEX trip_positions_trip_idx
        ON trip_positions (trip_id, recorded_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // El índice se borra junto con la tabla
    await queryRunner.query(`DROP TABLE trip_positions;`);
  }
}
