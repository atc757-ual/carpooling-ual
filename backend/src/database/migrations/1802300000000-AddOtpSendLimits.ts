import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOtpSendLimits1802300000000 implements MigrationInterface {
  name = 'AddOtpSendLimits1802300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE otp_send_limits (
        recipient_hash char(64) PRIMARY KEY,
        window_started_at timestamptz NOT NULL,
        send_count smallint NOT NULL DEFAULT 0,
        locked_until timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_otp_send_limits_window ON otp_send_limits (window_started_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE otp_send_limits`);
  }
}
