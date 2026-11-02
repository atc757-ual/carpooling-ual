import { MigrationInterface, QueryRunner } from 'typeorm';

// Sobre común de los eventos (DP-05, RNF-08, RNF-11, RNF-13):
// - events.sequence: número creciente y único en el orden en que se guarda
//   cada evento. El Gemelo Digital (único consumidor) los procesa por él y
//   descarta los repetidos. Los que ya existían se numeran por occurred_at
//   (y por id si coinciden), en el orden en que ocurrieron
// - events.version: versión del contrato de su tipo (docs/api/events.md)
export class AddEventSequenceAndVersion1795200000000 implements MigrationInterface {
  name = 'AddEventSequenceAndVersion1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE events
        ADD COLUMN sequence bigint,
        ADD COLUMN version smallint NOT NULL DEFAULT 1 CHECK (version > 0);

      WITH ordered AS (
        SELECT id, row_number() OVER (ORDER BY occurred_at, id) AS position
          FROM events
      )
      UPDATE events
         SET sequence = ordered.position
        FROM ordered
       WHERE events.id = ordered.id;

      CREATE SEQUENCE events_sequence_seq OWNED BY events.sequence;
      SELECT setval(
        'events_sequence_seq',
        COALESCE((SELECT max(sequence) FROM events), 0) + 1,
        false
      );

      ALTER TABLE events
        ALTER COLUMN sequence SET DEFAULT nextval('events_sequence_seq'),
        ALTER COLUMN sequence SET NOT NULL,
        ADD CONSTRAINT events_sequence_key UNIQUE (sequence);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE events
        DROP CONSTRAINT events_sequence_key,
        DROP COLUMN version,
        DROP COLUMN sequence;
    `);
  }
}
