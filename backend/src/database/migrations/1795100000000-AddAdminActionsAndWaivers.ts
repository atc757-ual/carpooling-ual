import { MigrationInterface, QueryRunner } from 'typeorm';

// Gestión de usuarios desde el panel (RF-25, CU-13):
// - admin_actions: auditoría de cada acción de un administrador (quién, qué,
//   a quién, motivo y cuándo)
// - late_cancellations gana waived_at, waived_by y waived_reason: un
//   administrador puede perdonar las cancelaciones tardías para levantar una
//   suspensión antes de tiempo; las perdonadas ya no cuentan
export class AddAdminActionsAndWaivers1795100000000 implements MigrationInterface {
  name = 'AddAdminActionsAndWaivers1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE admin_actions (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id       uuid REFERENCES users(id) ON DELETE SET NULL,
        action         varchar(60) NOT NULL,
        target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        details        jsonb NOT NULL DEFAULT '{}',
        reason         varchar(500) NOT NULL,
        created_at     timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX admin_actions_target_idx
        ON admin_actions (target_user_id, created_at DESC);

      ALTER TABLE late_cancellations
        ADD COLUMN waived_at timestamptz,
        ADD COLUMN waived_by uuid REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN waived_reason varchar(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE late_cancellations
        DROP COLUMN waived_reason,
        DROP COLUMN waived_by,
        DROP COLUMN waived_at;
      DROP TABLE admin_actions;
    `);
  }
}
