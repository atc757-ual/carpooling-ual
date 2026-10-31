import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPassengerRequestLimits1794200000000 implements MigrationInterface {
  name = 'AddPassengerRequestLimits1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE requests
        ADD COLUMN answered_at timestamptz,
        ADD COLUMN cancelled_at timestamptz
    `);
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'request_conflict_cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications WHERE type = 'request_conflict_cancelled'`,
    );
    await queryRunner.query(`
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TYPE notification_type RENAME TO notification_type_old;
      CREATE TYPE notification_type AS ENUM (
        'request_received', 'request_accepted', 'request_rejected',
        'request_cancelled', 'trip_cancelled', 'passenger_left',
        'incident_reported', 'trip_started'
      );
      ALTER TABLE notifications
        ALTER COLUMN type TYPE notification_type
        USING type::text::notification_type;
      DROP TYPE notification_type_old;
      ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
        (type = 'incident_reported' AND incident_id IS NOT NULL
           AND request_id IS NULL)
        OR (type <> 'incident_reported' AND request_id IS NOT NULL
           AND incident_id IS NULL)
      );
    `);
    await queryRunner.query(`
      ALTER TABLE requests
        DROP COLUMN answered_at,
        DROP COLUMN cancelled_at
    `);
  }
}
