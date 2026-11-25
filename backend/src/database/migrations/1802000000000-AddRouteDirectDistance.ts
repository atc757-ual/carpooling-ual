import { MigrationInterface, QueryRunner } from 'typeorm';

// routes.direct_distance_km: los km de la ruta sin recogidas, del origen al
// destino, para el CO₂ ahorrado (el coche que se evita va directo; la ruta
// guardada lleva los desvíos). Las rutas que ya hay toman su distancia, como
// direct_duration_min en AddPickupModes
export class AddRouteDirectDistance1802000000000 implements MigrationInterface {
  name = 'AddRouteDirectDistance1802000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE routes ADD COLUMN direct_distance_km numeric(7,2)`,
    );
    await queryRunner.query(
      `UPDATE routes SET direct_distance_km = distance_km`,
    );
    await queryRunner.query(
      `ALTER TABLE routes ALTER COLUMN direct_distance_km SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE routes DROP COLUMN direct_distance_km`,
    );
  }
}
