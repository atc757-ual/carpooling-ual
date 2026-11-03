import { MigrationInterface, QueryRunner } from 'typeorm';

// Denunciar un mensaje del chat del viaje: la incidencia guarda el id del
// mensaje (sin clave foránea: los mensajes se borran a los 30 días; la
// incidencia lleva una copia del texto en su descripción). Cada usuario puede
// denunciar un mensaje una sola vez
export class AddIncidentChatMessage1796600000000 implements MigrationInterface {
  name = 'AddIncidentChatMessage1796600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE incidents ADD COLUMN chat_message_id uuid NULL;
      CREATE UNIQUE INDEX incidents_chat_message_reporter_key
        ON incidents (chat_message_id, reporter_id)
        WHERE chat_message_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX incidents_chat_message_reporter_key;
      ALTER TABLE incidents DROP COLUMN chat_message_id;
    `);
  }
}
