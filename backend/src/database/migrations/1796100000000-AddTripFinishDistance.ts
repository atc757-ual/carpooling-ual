import { MigrationInterface, QueryRunner } from 'typeorm';

// A cuántos metros del destino estaba el conductor al terminar el viaje (la
// posición que envía la app al pulsar «Terminar»); null si no la envió (sin
// GPS) o si el viaje terminó de otra forma. Sirve para medir cuántos viajes
// se cierran lejos del destino (Gemelo Digital y métricas)
export class AddTripFinishDistance1796100000000 implements MigrationInterface {
  name = 'AddTripFinishDistance1796100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trips
        ADD COLUMN finish_distance_m integer NULL
          CHECK (finish_distance_m >= 0);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE trips DROP COLUMN finish_distance_m;`);
  }
}
