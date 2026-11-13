import { MigrationInterface, QueryRunner } from 'typeorm';

// Modos de recogida y presupuesto total de desvío (reunión con el director
// del 12/11/2026; docs/diseno-modos-recogida-y-vuelta.md):
// - trips.pickup_mode: en ruta o en puntos (los viajes que ya hay, en ruta)
// - trips.max_detour_m: cuánto se aparta en ruta (300, 500 o 1000 m)
// - routes.direct_duration_min: la ruta sin recogidas, para medir el desvío
//   gastado (las rutas que ya hay no tienen recogidas: la misma duración)
// - trip_pickups: dónde y cuándo recoge a cada pasajero aceptado
export class AddPickupModes1799300000000 implements MigrationInterface {
  name = 'AddPickupModes1799300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE trip_pickup_mode AS ENUM ('on_route', 'stops')`,
    );
    await queryRunner.query(`
      ALTER TABLE trips
        ADD COLUMN pickup_mode trip_pickup_mode NOT NULL DEFAULT 'on_route',
        ADD COLUMN max_detour_m smallint DEFAULT 500,
        ADD CONSTRAINT trips_max_detour_m_check
          CHECK (max_detour_m IS NULL OR max_detour_m IN (300, 500, 1000)),
        ADD CONSTRAINT trips_pickup_mode_detour_m_check
          CHECK ((pickup_mode = 'on_route') = (max_detour_m IS NOT NULL))
    `);
    await queryRunner.query(
      `ALTER TABLE routes ADD COLUMN direct_duration_min integer`,
    );
    await queryRunner.query(
      `UPDATE routes SET direct_duration_min = duration_min`,
    );
    await queryRunner.query(
      `ALTER TABLE routes ALTER COLUMN direct_duration_min SET NOT NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE trip_pickups (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        request_id uuid NOT NULL REFERENCES requests (id) ON DELETE CASCADE,
        location geography(Point, 4326) NOT NULL,
        position smallint NOT NULL CHECK (position >= 0),
        eta_offset_min smallint NOT NULL CHECK (eta_offset_min >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trip_pickups_request_id_key UNIQUE (request_id),
        CONSTRAINT trip_pickups_trip_position_key
          UNIQUE (trip_id, position) DEFERRABLE INITIALLY DEFERRED
      )
    `);
    await queryRunner.query(
      `CREATE INDEX trip_pickups_trip_id_idx ON trip_pickups (trip_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE trip_pickups`);
    await queryRunner.query(
      `ALTER TABLE routes DROP COLUMN direct_duration_min`,
    );
    await queryRunner.query(`
      ALTER TABLE trips
        DROP CONSTRAINT trips_pickup_mode_detour_m_check,
        DROP CONSTRAINT trips_max_detour_m_check,
        DROP COLUMN max_detour_m,
        DROP COLUMN pickup_mode
    `);
    await queryRunner.query(`DROP TYPE trip_pickup_mode`);
  }
}
