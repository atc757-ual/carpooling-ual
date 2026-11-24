import { MigrationInterface, QueryRunner } from 'typeorm';

// Aviso nuevo, trip_vehicle_changed: el conductor ha pasado un viaje a otro
// coche (al darlo de baja o por una avería puntual) y se avisa a cada
// pasajero aceptado, con su solicitud, como trip_started
export class AddTripVehicleChangedNotification1801700000000 implements MigrationInterface {
  name = 'AddTripVehicleChangedNotification1801700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trip_vehicle_changed'`,
    );
  }

  // El valor nuevo del tipo se queda (PostgreSQL no permite quitarlo)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications WHERE type::text = 'trip_vehicle_changed'`,
    );
  }
}
