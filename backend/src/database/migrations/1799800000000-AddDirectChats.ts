import { MigrationInterface, QueryRunner } from 'typeorm';

// Chats directos: el chat del viaje deja de ser uno común a todos sus
// participantes y pasa a ser una conversación entre el conductor y cada
// pasajero aceptado (la conversación = viaje + pasajero):
// - chat_messages.passenger_id: el pasajero de la conversación. Los mensajes
//   que ya existen se quedan con NULL: son el chat común anterior, que se
//   muestra como historial de solo lectura (ya lo veían todos)
// - chat_reads: hasta cuándo ha leído cada participante cada conversación.
//   Las lecturas de los pasajeros pasan a su conversación; las del conductor
//   se borran (eran del chat común, que ya no cuenta como no leído)
export class AddDirectChats1799800000000 implements MigrationInterface {
  name = 'AddDirectChats1799800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_messages
        ADD COLUMN passenger_id uuid REFERENCES users (id) ON DELETE CASCADE;
      -- Los mensajes de una conversación en orden
      CREATE INDEX chat_messages_conversation_idx
        ON chat_messages (trip_id, passenger_id, created_at, id);

      ALTER TABLE chat_reads
        ADD COLUMN passenger_id uuid REFERENCES users (id) ON DELETE CASCADE;
      UPDATE chat_reads r
         SET passenger_id = r.user_id
        FROM trips t
       WHERE t.id = r.trip_id AND t.driver_id <> r.user_id;
      DELETE FROM chat_reads WHERE passenger_id IS NULL;
      ALTER TABLE chat_reads ALTER COLUMN passenger_id SET NOT NULL;
      ALTER TABLE chat_reads DROP CONSTRAINT chat_reads_pkey;
      ALTER TABLE chat_reads ADD PRIMARY KEY (trip_id, passenger_id, user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los mensajes directos se borran: en el chat común los verían todos
    await queryRunner.query(`
      DELETE FROM chat_reads WHERE user_id <> passenger_id;
      ALTER TABLE chat_reads DROP CONSTRAINT chat_reads_pkey;
      ALTER TABLE chat_reads DROP COLUMN passenger_id;
      ALTER TABLE chat_reads ADD PRIMARY KEY (trip_id, user_id);

      DELETE FROM chat_messages WHERE passenger_id IS NOT NULL;
      DROP INDEX chat_messages_conversation_idx;
      ALTER TABLE chat_messages DROP COLUMN passenger_id;
    `);
  }
}
