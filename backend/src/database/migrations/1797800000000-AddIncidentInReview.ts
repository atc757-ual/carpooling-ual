import { MigrationInterface, QueryRunner } from 'typeorm';

// La revisión de una incidencia pasa a tener tres estados (CU-12): registrada
// (open), en revisión (in_review, con quién la revisa y desde cuándo) y
// atendida (reviewed). La regla CHECK exige los datos de cada uno; las
// atendidas antes de este cambio no tienen quién empezó la revisión.
// El valor nuevo del enum no se puede usar en la misma transacción en que se
// añade: la regla lo compara como texto
const REVIEW_CHECK = `
  ADD CONSTRAINT incidents_review_check CHECK (
    (status::text = 'open'
       AND review_started_by IS NULL AND review_started_at IS NULL
       AND reviewed_by IS NULL AND reviewed_at IS NULL AND resolution IS NULL)
    OR (status::text = 'in_review'
       AND review_started_by IS NOT NULL AND review_started_at IS NOT NULL
       AND reviewed_by IS NULL AND reviewed_at IS NULL AND resolution IS NULL)
    OR (status::text = 'reviewed'
       AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
       AND resolution IS NOT NULL)
  )
`;

export class AddIncidentInReview1797800000000 implements MigrationInterface {
  name = 'AddIncidentInReview1797800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE incident_status ADD VALUE 'in_review' BEFORE 'reviewed';
      ALTER TABLE incidents
        DROP CONSTRAINT incidents_review_check,
        ADD COLUMN review_started_by uuid REFERENCES users (id),
        ADD COLUMN review_started_at timestamptz,
        ${REVIEW_CHECK};
    `);
  }

  // Las que estaban en revisión vuelven a registradas, y el enum se rehace sin
  // el valor (PostgreSQL no permite quitarlo)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE incidents DROP CONSTRAINT incidents_review_check;
      UPDATE incidents
         SET status = 'open', review_started_by = NULL, review_started_at = NULL
       WHERE status = 'in_review';
      ALTER TABLE incidents
        DROP COLUMN review_started_by,
        DROP COLUMN review_started_at,
        ALTER COLUMN status DROP DEFAULT;
      ALTER TYPE incident_status RENAME TO incident_status_old;
      CREATE TYPE incident_status AS ENUM ('open', 'reviewed');
      ALTER TABLE incidents
        ALTER COLUMN status TYPE incident_status
          USING status::text::incident_status,
        ALTER COLUMN status SET DEFAULT 'open',
        ADD CONSTRAINT incidents_review_check CHECK (
          (status = 'open' AND reviewed_by IS NULL AND reviewed_at IS NULL
             AND resolution IS NULL)
          OR (status = 'reviewed' AND reviewed_by IS NOT NULL
             AND reviewed_at IS NOT NULL AND resolution IS NOT NULL)
        );
      DROP TYPE incident_status_old;
    `);
  }
}
