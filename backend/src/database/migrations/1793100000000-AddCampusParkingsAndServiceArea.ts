import { MigrationInterface, QueryRunner } from 'typeorm';

// Lugares de referencia del campus (datos de la plataforma, también en
// producción: por eso van en la migración y no en el seed).
// - campus_parkings: los 5 parkings del campus de La Cañada, los destinos (o
//   el origen, al volver) de los viajes al campus. Coordenadas dadas por el
//   autor desde el mapa.
// - service_areas: la zona con cobertura, un círculo de 30 km alrededor del
//   centro del campus (la media de los 5 parkings). Se guardan el centro y el
//   radio, y el polígono calculado con ST_Buffer para las consultas (ST_Covers)
export class AddCampusParkingsAndServiceArea1793100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE campus_parkings (
        id         varchar(20) PRIMARY KEY,
        name       varchar(60) NOT NULL,
        location   geography(Point, 4326) NOT NULL,
        is_active  boolean NOT NULL DEFAULT true,
        sort_order smallint NOT NULL
      );

      INSERT INTO campus_parkings (id, name, location, sort_order) VALUES
        ('p1', 'Parking P1', ST_SetSRID(ST_MakePoint(-2.4045, 36.8322), 4326)::geography, 1),
        ('p2', 'Parking P2', ST_SetSRID(ST_MakePoint(-2.4012, 36.8315), 4326)::geography, 2),
        ('p3', 'Parking P3', ST_SetSRID(ST_MakePoint(-2.4068, 36.8291), 4326)::geography, 3),
        ('p4', 'Parking P4', ST_SetSRID(ST_MakePoint(-2.4018, 36.8302), 4326)::geography, 4),
        ('p5', 'Parking P5', ST_SetSRID(ST_MakePoint(-2.4025, 36.8285), 4326)::geography, 5);

      CREATE TABLE service_areas (
        id        varchar(30) PRIMARY KEY,
        name      varchar(80) NOT NULL,
        center    geography(Point, 4326) NOT NULL,
        radius_m  integer NOT NULL CHECK (radius_m > 0),
        area      geography(Polygon, 4326) NOT NULL,
        is_active boolean NOT NULL DEFAULT true
      );

      INSERT INTO service_areas (id, name, center, radius_m, area)
      SELECT 'ual-30km', 'Campus UAL · 30 km', center, 30000,
             ST_Buffer(center, 30000)::geography
      FROM (SELECT ST_SetSRID(ST_MakePoint(-2.4034, 36.8303), 4326)::geography AS center) AS campus;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE service_areas;
      DROP TABLE campus_parkings;
    `);
  }
}
