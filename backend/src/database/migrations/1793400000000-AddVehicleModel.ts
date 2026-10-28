import { MigrationInterface, QueryRunner } from 'typeorm';

// Marca y modelo del vehículo («Seat Ibiza»), para que el pasajero reconozca
// el coche. Opcional: los vehículos ya registrados no lo tienen
export class AddVehicleModel1793400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE vehicles ADD COLUMN model varchar(60) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vehicles DROP COLUMN model`);
  }
}
