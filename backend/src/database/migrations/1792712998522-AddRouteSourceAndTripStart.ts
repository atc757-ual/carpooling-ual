import { MigrationInterface, QueryRunner } from 'typeorm';

// Ruta del viaje (RF-12, CU-08):
// - routes.source: de dónde sale la ruta. "osrm" es la ruta real por
//   carretera; "estimated", la estimación en línea recta que se usa si OSRM no
//   responde (plan B del análisis de riesgos). Así nunca se presenta una
//   estimación como si fuera la ruta real. Las rutas que ya existían (las del
//   seed) son aproximadas
// - trips.started_at: cuándo empezó el viaje, para la llegada estimada. Un
//   viaje en curso o finalizado siempre lo tiene
export class AddRouteSourceAndTripStart1792712998522 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE route_source AS ENUM ('osrm', 'estimated');

      ALTER TABLE routes
        ADD COLUMN source route_source NOT NULL DEFAULT 'estimated';
      ALTER TABLE routes ALTER COLUMN source DROP DEFAULT;

      ALTER TABLE trips
        ADD COLUMN started_at timestamptz,
        ADD CONSTRAINT trips_started_at_check CHECK (
          started_at IS NOT NULL OR status NOT IN ('in_progress', 'finished')
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trips
        DROP CONSTRAINT trips_started_at_check,
        DROP COLUMN started_at;

      ALTER TABLE routes DROP COLUMN source;
      DROP TYPE route_source;
    `);
  }
}
