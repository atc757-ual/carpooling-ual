import { MigrationInterface, QueryRunner } from 'typeorm';

// Reseñas y reputación por rol (RF-22, doble ciego):
// - trips.finished_at marca el inicio del plazo de 7 días para valorar
// - driver_profiles.rating_count y passenger_profiles.rating_count guardan el
//   número de reseñas publicadas de cada rol (la media solo se muestra con >= 3)
// - tabla reviews con índice único (trip_id, author_id, target_id) y
//   published_at (null mientras espera a la otra parte o al fin de los 7 días)
// - aviso review_requested al terminar un viaje con pasajeros aceptados
export class AddReviews1794700000000 implements MigrationInterface {
  name = 'AddReviews1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trips
        ADD COLUMN finished_at timestamptz;

      UPDATE trips
         SET finished_at = updated_at
       WHERE status = 'finished'
         AND finished_at IS NULL;

      ALTER TABLE driver_profiles
        ADD COLUMN rating_count integer NOT NULL DEFAULT 0
          CHECK (rating_count >= 0);

      ALTER TABLE passenger_profiles
        ADD COLUMN rating_count integer NOT NULL DEFAULT 0
          CHECK (rating_count >= 0);

      UPDATE driver_profiles
         SET rating_count = 5
       WHERE average_rating IS NOT NULL
         AND rating_count = 0;

      UPDATE passenger_profiles
         SET rating_count = 4
       WHERE average_rating IS NOT NULL
         AND rating_count = 0;

      CREATE TYPE review_target_role AS ENUM ('driver', 'passenger');

      CREATE TABLE reviews (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id      uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        author_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_role  review_target_role NOT NULL,
        rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment      varchar(300),
        created_at   timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        CONSTRAINT reviews_author_not_target_check CHECK (author_id <> target_id),
        CONSTRAINT reviews_trip_author_target_key UNIQUE (trip_id, author_id, target_id)
      );

      CREATE INDEX reviews_target_role_published_idx
        ON reviews (target_id, target_role, published_at DESC, id ASC);

      CREATE INDEX reviews_author_created_idx
        ON reviews (author_id, created_at DESC, id ASC);
    `);

    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_requested'`,
    );

    await queryRunner.query(`
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
        (type::text = 'incident_reported' AND incident_id IS NOT NULL
           AND request_id IS NULL)
        OR (type::text = 'review_requested' AND incident_id IS NULL)
        OR (type::text NOT IN ('incident_reported', 'review_requested')
           AND request_id IS NOT NULL AND incident_id IS NULL)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications WHERE type::text = 'review_requested'`,
    );
    await queryRunner.query(`
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TYPE notification_type RENAME TO notification_type_old;
      CREATE TYPE notification_type AS ENUM (
        'request_received', 'request_accepted', 'request_rejected',
        'request_cancelled', 'request_conflict_cancelled', 'trip_cancelled',
        'passenger_left', 'trip_started', 'incident_reported'
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

      DROP TABLE reviews;
      DROP TYPE review_target_role;

      ALTER TABLE passenger_profiles DROP COLUMN rating_count;
      ALTER TABLE driver_profiles DROP COLUMN rating_count;
      ALTER TABLE trips DROP COLUMN finished_at;
    `);
  }
}

