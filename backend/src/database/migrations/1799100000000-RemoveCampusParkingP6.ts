import { MigrationInterface, QueryRunner } from 'typeorm';

// Eliminar el Parking P6 (Oeste) del catálogo de parkings del campus:
// está fuera del recinto de la UAL y no se utiliza.
// El centro de la zona de servicio de 30 km se recalcula con la media de los 5 parkings reales.
export class RemoveCampusParkingP61799100000000 implements MigrationInterface {
  name = 'RemoveCampusParkingP61799100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM campus_parkings WHERE id = 'p6'`);
    await queryRunner.query(`
      UPDATE service_areas
      SET center = campus.center,
          area = ST_Buffer(campus.center, radius_m)::geography
      FROM (
        SELECT ST_SetSRID(
                 ST_MakePoint(AVG(ST_X(location::geometry)), AVG(ST_Y(location::geometry))),
                 4326
               )::geography AS center
        FROM campus_parkings
      ) AS campus
      WHERE id = 'ual-30km'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO campus_parkings (id, name, location, sort_order)
      VALUES ('p6', 'Parking P6 (Oeste)', ST_SetSRID(ST_MakePoint(-2.400965, 36.833207), 4326)::geography, 6)
      ON CONFLICT (id) DO UPDATE SET is_active = true;
    `);
    await queryRunner.query(`
      UPDATE service_areas
      SET center = campus.center,
          area = ST_Buffer(campus.center, radius_m)::geography
      FROM (
        SELECT ST_SetSRID(
                 ST_MakePoint(AVG(ST_X(location::geometry)), AVG(ST_Y(location::geometry))),
                 4326
               )::geography AS center
        FROM campus_parkings
      ) AS campus
      WHERE id = 'ual-30km'
    `);
  }
}
