import { MigrationInterface, QueryRunner } from 'typeorm';

// La simulación puede contar también a quienes van en transporte público o de
// otra forma y se apuntan al carpooling (accesibilidad). Cada réplica guarda
// cuántos tramos piden plaza, cuántos la consiguen y los coches que salen de
// más. NULL en las réplicas de antes: no lo medían
export class AddOtherModeToResults1801600000000 implements MigrationInterface {
  name = 'AddOtherModeToResults1801600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE simulation_results ADD COLUMN other_mode jsonb',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE simulation_results DROP COLUMN other_mode',
    );
  }
}
