import { MigrationInterface, QueryRunner } from 'typeorm';

// En el borrador de la Política de privacidad 1.1 (pendiente de revisar con el
// director), se añade la confirmación de lectura en el chat del viaje (doble
// check): al abrir el chat se registra la hora de lectura (chat_reads), lo que
// permite a quien envió un mensaje saber si todos los demás participantes lo
// han leído. Solo cambia el borrador (una versión publicada no se puede cambiar)
// y solo donde encuentra el texto previo.
const ITEM_OLD =
  '  <li>Los mensajes del chat de cada viaje y las denuncias de esos chats.</li>';
const ITEM_NEW =
  '  <li>Los mensajes del chat de cada viaje, las confirmaciones de lectura y las denuncias de esos chats.</li>';

const TEXT_OLD =
  'Si la conversación te parece inapropiada puedes denunciarla: la\n  administración recibe una copia de la conversación y tu motivo, y nadie del viaje sabe quién la\n  denunció.';
const TEXT_NEW =
  'Al abrir el chat se actualiza tu hora de lectura, permitiendo a quien escribió saber si todos han leído su mensaje (confirmación de lectura). Si la conversación te parece inapropiada puedes denunciarla: la\n  administración recibe una copia de la conversación y tu motivo, y nadie del viaje sabe quién la\n  denunció.';

export class AddChatReadReceiptsToPrivacyDraft1797500000000 implements MigrationInterface {
  name = 'AddChatReadReceiptsToPrivacyDraft1797500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE legal_documents
          SET content = replace(replace(content, $1, $2), $3, $4)
        WHERE type = 'privacy' AND status = 'draft'`,
      [ITEM_OLD, ITEM_NEW, TEXT_OLD, TEXT_NEW],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE legal_documents
          SET content = replace(replace(content, $2, $1), $4, $3)
        WHERE type = 'privacy' AND status = 'draft'`,
      [ITEM_OLD, ITEM_NEW, TEXT_OLD, TEXT_NEW],
    );
  }
}
