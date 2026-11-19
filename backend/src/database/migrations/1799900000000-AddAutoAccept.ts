import { MigrationInterface, QueryRunner } from 'typeorm';

// Aceptación automática: el conductor la
// elige al publicar y las solicitudes que caben se aceptan solas.
// - trips.auto_accept: si el viaje acepta solo (no en los que ya existen)
// - notification_type: passenger_joined («Pía se ha unido a tu viaje»), al
//   conductor en lugar de «Te han pedido plaza», con la solicitud
export class AddAutoAccept1799900000000 implements MigrationInterface {
  name = 'AddAutoAccept1799900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE trips ADD COLUMN auto_accept boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'passenger_joined'`,
    );
  }

  // El valor nuevo del tipo se queda (PostgreSQL no permite quitarlo): sus
  // avisos pasan a ser de una solicitud recibida
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE notifications SET type = 'request_received' WHERE type::text = 'passenger_joined'`,
    );
    await queryRunner.query(`ALTER TABLE trips DROP COLUMN auto_accept`);
  }
}
