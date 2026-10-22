import { MigrationInterface, QueryRunner } from 'typeorm';

// Revisión de incidencias por el administrador (CU-12: "incidencia revisada y
// cerrada"). La regla CHECK impide una revisión a medias: abierta, sin datos
// de revisión; revisada, con quién, cuándo y la resolución
export class AddIncidentReview1792708523655 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE incident_status AS ENUM ('open', 'reviewed');

      ALTER TABLE incidents
        ADD COLUMN status      incident_status NOT NULL DEFAULT 'open',
        ADD COLUMN reviewed_by uuid REFERENCES users (id),
        ADD COLUMN reviewed_at timestamptz,
        ADD COLUMN resolution  text,
        ADD CONSTRAINT incidents_review_check CHECK (
          (status = 'open' AND reviewed_by IS NULL AND reviewed_at IS NULL
             AND resolution IS NULL)
          OR (status = 'reviewed' AND reviewed_by IS NOT NULL
             AND reviewed_at IS NOT NULL AND resolution IS NOT NULL)
        );

      -- La lista del administrador: por estado y por orden de llegada
      CREATE INDEX incidents_status_idx ON incidents (status, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX incidents_status_idx;

      ALTER TABLE incidents
        DROP CONSTRAINT incidents_review_check,
        DROP COLUMN resolution,
        DROP COLUMN reviewed_at,
        DROP COLUMN reviewed_by,
        DROP COLUMN status;

      DROP TYPE incident_status;
    `);
  }
}
