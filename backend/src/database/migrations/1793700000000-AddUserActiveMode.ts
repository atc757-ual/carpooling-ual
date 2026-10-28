import { MigrationInterface, QueryRunner } from 'typeorm';

// Modo con el que viaja ahora quien tiene los dos perfiles (pasajero o
// conductor), para que sea el mismo en todos sus dispositivos. NULL hasta que
// lo cambia por primera vez: el cliente usa entonces su modo por defecto
export class AddUserActiveMode1793700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users
         ADD COLUMN active_mode varchar(10) NULL
         CONSTRAINT users_active_mode_check
         CHECK (active_mode IN ('passenger', 'driver'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN active_mode`);
  }
}
