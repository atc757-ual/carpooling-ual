import { MigrationInterface, QueryRunner } from 'typeorm';

// Chat del viaje entre el conductor y sus pasajeros aceptados («Podría» del
// capítulo 6):
// - chat_messages: texto libre (hasta 500) o una respuesta rápida (solo su
//   clave; el texto lo pone la app en su idioma). La regla CHECK impide un
//   mensaje a medias
// - chat_reads: hasta cuándo ha leído cada participante (los no leídos)
// Los dos caen en cascada con el viaje
export class AddChat1796500000000 implements MigrationInterface {
  name = 'AddChat1796500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE chat_message_kind AS ENUM ('text', 'quick');

      CREATE TABLE chat_messages (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        author_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        kind        chat_message_kind NOT NULL,
        body        varchar(500),
        quick_reply varchar(30),
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chat_messages_content_check CHECK (
          (kind = 'text' AND body IS NOT NULL AND quick_reply IS NULL)
          OR (kind = 'quick' AND quick_reply IS NOT NULL AND body IS NULL)
        )
      );
      -- Los mensajes de un viaje en orden, y los de un autor en el último
      -- minuto (límite de envíos)
      CREATE INDEX chat_messages_trip_idx ON chat_messages (trip_id, created_at, id);
      CREATE INDEX chat_messages_author_idx ON chat_messages (author_id, created_at);

      CREATE TABLE chat_reads (
        trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        last_read_at timestamptz NOT NULL,
        PRIMARY KEY (trip_id, user_id)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE chat_reads;
      DROP TABLE chat_messages;
      DROP TYPE chat_message_kind;
    `);
  }
}
