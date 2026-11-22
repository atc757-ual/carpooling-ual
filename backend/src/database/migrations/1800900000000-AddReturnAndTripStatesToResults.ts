import { MigrationInterface, QueryRunner } from 'typeorm';

// La simulación hace también la vuelta del campus y distingue cómo terminan
// los viajes. Cada réplica guarda los vehículos de la vuelta (los de
// vehicle_count pasan a ser los del día) y los viajes terminados, caducados
// y cancelados. NULL en las réplicas de antes: sus cifras siguen como estaban
export class AddReturnAndTripStatesToResults1800900000000 implements MigrationInterface {
  name = 'AddReturnAndTripStatesToResults1800900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE simulation_results
         ADD COLUMN return_vehicle_count integer,
         ADD COLUMN return_baseline_vehicle_count integer,
         ADD COLUMN trip_states jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE simulation_results
         DROP COLUMN trip_states,
         DROP COLUMN return_baseline_vehicle_count,
         DROP COLUMN return_vehicle_count`,
    );
  }
}
