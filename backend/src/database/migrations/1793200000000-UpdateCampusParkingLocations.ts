import { MigrationInterface, QueryRunner } from 'typeorm';

// Ubicaciones exactas de los parkings del campus (tomadas por el autor en la
// entrada de cada uno) y un sexto parking, P6. El centro de la zona de servicio
// sigue siendo la media de los parkings, así que se recalcula con ellos (y el
// círculo de 30 km a su alrededor)
const PARKINGS: readonly [id: string, lon: number, lat: number][] = [
  ['p1', -2.401719, 36.828856],
  ['p2', -2.404599, 36.827641],
  ['p3', -2.408837, 36.829345],
  ['p4', -2.403504, 36.831499],
  ['p5', -2.402255, 36.83189],
  ['p6', -2.400965, 36.833207],
];

// Las de la migración anterior, para deshacer
const PREVIOUS: readonly [id: string, lon: number, lat: number][] = [
  ['p1', -2.4045, 36.8322],
  ['p2', -2.4012, 36.8315],
  ['p3', -2.4068, 36.8291],
  ['p4', -2.4018, 36.8302],
  ['p5', -2.4025, 36.8285],
];

const POINT = 'ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography';

export class UpdateCampusParkingLocations1793200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO campus_parkings (id, name, location, sort_order)
       VALUES ('p6', 'Parking P6', ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography, 6)`,
    );
    await this.moveParkings(queryRunner, PARKINGS);
    await this.centerServiceArea(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM campus_parkings WHERE id = 'p6'`);
    await this.moveParkings(queryRunner, PREVIOUS);
    await this.centerServiceArea(queryRunner);
  }

  private async moveParkings(
    queryRunner: QueryRunner,
    parkings: readonly [string, number, number][],
  ): Promise<void> {
    for (const [id, lon, lat] of parkings) {
      await queryRunner.query(
        `UPDATE campus_parkings SET location = ${POINT} WHERE id = $1`,
        [id, lon, lat],
      );
    }
  }

  // El centro, en la media de los parkings, y el círculo con su radio
  private async centerServiceArea(queryRunner: QueryRunner): Promise<void> {
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
