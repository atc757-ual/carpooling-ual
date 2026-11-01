import { MigrationInterface, QueryRunner } from 'typeorm';

// Guarda el contexto de recogida necesario para mostrar una solicitud tras
// volver a entrar en la app. Los datos son null para solicitudes anteriores.
export class AddRequestPickupContext1794800000000 implements MigrationInterface {
  name = 'AddRequestPickupContext1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requests
        ADD COLUMN pickup_location geography(Point, 4326),
        ADD COLUMN pickup_name varchar(160),
        ADD COLUMN direction varchar(16),
        ADD COLUMN pickup_at timestamptz,
        ADD CONSTRAINT requests_direction_check
          CHECK (direction IS NULL OR direction IN ('to-campus', 'from-campus'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requests
        DROP CONSTRAINT requests_direction_check,
        DROP COLUMN pickup_at,
        DROP COLUMN direction,
        DROP COLUMN pickup_name,
        DROP COLUMN pickup_location
    `);
  }
}
