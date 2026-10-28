import { MigrationInterface, QueryRunner } from 'typeorm';

// Plazas que pide cada solicitud (RF-08): un pasajero puede ir con
// compañeros. De 1 a 4, como en la búsqueda; las existentes son de 1
export class AddSeatRequestSeats1793500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE requests
         ADD COLUMN seats smallint NOT NULL DEFAULT 1
         CONSTRAINT requests_seats_check CHECK (seats BETWEEN 1 AND 4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE requests DROP COLUMN seats`);
  }
}
