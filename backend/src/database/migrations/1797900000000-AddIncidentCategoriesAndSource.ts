import { MigrationInterface, QueryRunner } from 'typeorm';

// Dos categorías nuevas (seguridad y comportamiento en el chat) y el origen de
// cada incidencia: el viaje en curso (RF-23) o una denuncia del chat. El origen
// se guardaba solo en el texto: las denuncias del chat se reconocen por el
// mensaje denunciado (las antiguas) o por el principio de su descripción. Su
// categoría no se cambia: el valor nuevo del enum no se puede usar en la misma
// transacción en que se añade
export class AddIncidentCategoriesAndSource1797900000000 implements MigrationInterface {
  name = 'AddIncidentCategoriesAndSource1797900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE incident_category ADD VALUE 'safety' BEFORE 'other';
      ALTER TYPE incident_category ADD VALUE 'chat_behavior' BEFORE 'other';
      CREATE TYPE incident_source AS ENUM ('trip', 'chat');
      ALTER TABLE incidents ADD COLUMN source incident_source NOT NULL DEFAULT 'trip';
      UPDATE incidents
         SET source = 'chat'
       WHERE chat_message_id IS NOT NULL
          OR description LIKE 'Chat del viaje denunciado.%';
      ALTER TABLE incidents ALTER COLUMN source DROP DEFAULT;
    `);
  }

  // Las de las categorías nuevas pasan a «otro», y el enum se rehace sin ellas
  // (PostgreSQL no permite quitar valores)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE incidents DROP COLUMN source;
      DROP TYPE incident_source;
      UPDATE incidents SET category = 'other'
       WHERE category IN ('safety', 'chat_behavior');
      ALTER TYPE incident_category RENAME TO incident_category_old;
      CREATE TYPE incident_category AS ENUM ('technical', 'driver', 'passenger', 'other');
      ALTER TABLE incidents
        ALTER COLUMN category TYPE incident_category
          USING category::text::incident_category;
      DROP TYPE incident_category_old;
    `);
  }
}
