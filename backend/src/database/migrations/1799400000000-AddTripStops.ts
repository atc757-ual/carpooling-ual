import { MigrationInterface, QueryRunner } from 'typeorm';

// Recogida en puntos (docs/diseno-modos-recogida-y-vuelta.md, §4.1):
// - trip_stops: las paradas que elige el conductor (de 1 a 5, en orden a lo
//   largo de la ruta y a cuántos minutos de la salida, sin contar paradas)
// - requests.stop_id: la parada en la que sube el pasajero
// - trip_pickups.stop_id: la parada de cada recogida, para saber qué paradas
//   tienen ya a alguien que sube (solo esas suman su tiempo de parada)
export class AddTripStops1799400000000 implements MigrationInterface {
  name = 'AddTripStops1799400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE trip_stops (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        position smallint NOT NULL CHECK (position BETWEEN 0 AND 4),
        name varchar(160) NOT NULL,
        location geography(Point, 4326) NOT NULL,
        eta_offset_min smallint NOT NULL CHECK (eta_offset_min >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trip_stops_trip_position_key
          UNIQUE (trip_id, position) DEFERRABLE INITIALLY DEFERRED
      )
    `);
    await queryRunner.query(
      `CREATE INDEX trip_stops_location_idx ON trip_stops USING gist (location)`,
    );
    await queryRunner.query(`
      ALTER TABLE requests
        ADD COLUMN stop_id uuid REFERENCES trip_stops (id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE trip_pickups
        ADD COLUMN stop_id uuid REFERENCES trip_stops (id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE trip_pickups DROP COLUMN stop_id`);
    await queryRunner.query(`ALTER TABLE requests DROP COLUMN stop_id`);
    await queryRunner.query(`DROP TABLE trip_stops`);
  }
}
