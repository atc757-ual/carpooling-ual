import { MigrationInterface, QueryRunner } from 'typeorm';

// Fumar, sin «solo en paradas»: las paradas de un viaje compartido son muy
// cortas. Quien lo tuviera pasa a «no se fuma». PostgreSQL no deja quitar un
// valor de un ENUM, así que se crea el tipo de nuevo
export class DropSmokingAtStops1794900000001 implements MigrationInterface {
  name = 'DropSmokingAtStops1794900000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET pref_smoking = 'no' WHERE pref_smoking = 'stops_only';
      ALTER TYPE smoking_preference RENAME TO smoking_preference_old;
      CREATE TYPE smoking_preference AS ENUM ('no', 'allowed');
      ALTER TABLE users
        ALTER COLUMN pref_smoking TYPE smoking_preference
          USING pref_smoking::text::smoking_preference;
      DROP TYPE smoking_preference_old
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE smoking_preference RENAME TO smoking_preference_old;
      CREATE TYPE smoking_preference AS ENUM ('no', 'stops_only', 'allowed');
      ALTER TABLE users
        ALTER COLUMN pref_smoking TYPE smoking_preference
          USING pref_smoking::text::smoking_preference;
      DROP TYPE smoking_preference_old
    `);
  }
}
