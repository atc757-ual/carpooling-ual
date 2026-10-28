import { MigrationInterface, QueryRunner } from 'typeorm';

// Nombres del origen y el destino tal como los eligió el conductor al
// publicar («Roquetas de Mar», «Campus UAL · Parking P1 (Sur)»), para
// mostrarlos sin volver a geocodificar los puntos. Opcionales: los viajes ya
// publicados no los tienen
export class AddTripPlaceNames1793600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE trips
         ADD COLUMN origin_name varchar(160) NULL,
         ADD COLUMN destination_name varchar(160) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE trips DROP COLUMN origin_name, DROP COLUMN destination_name`,
    );
  }
}
