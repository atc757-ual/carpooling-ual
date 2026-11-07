import { MigrationInterface, QueryRunner } from 'typeorm';

// En el borrador de la Política de privacidad 1.1 (pendiente de revisar con el
// director), se añade la confirmación de lectura en el chat del viaje (doble
// check): al abrir el chat se registra la hora de lectura (chat_reads), lo que
// permite a quien envió un mensaje saber si todos los demás participantes lo
// han leído. Solo cambia el borrador (una versión publicada no se puede cambiar)
// y solo donde encuentra el texto previo.
const EDITS: readonly (readonly [string, string])[] = [
  [
    '  <li>Los mensajes del chat de cada viaje y las denuncias de esos chats.</li>',
    '  <li>Los mensajes del chat de cada viaje, las confirmaciones de lectura y las denuncias de esos chats.</li>',
  ],
  [
    'Si la conversación te parece inapropiada puedes denunciarla: la\n  administración recibe una copia de la conversación y tu motivo, y nadie del viaje sabe quién la\n  denunció.',
    'Al abrir el chat se actualiza tu hora de lectura, permitiendo a quien escribió saber si todos han leído su mensaje (confirmación de lectura). Si la conversación te parece inapropiada puedes denunciarla: la\n  administración recibe una copia de la conversación y tu motivo, y nadie del viaje sabe quién la\n  denunció.',
  ],
];

export class AddChatReadReceiptsToPrivacyDraft1797500000000 implements MigrationInterface {
  name = 'AddChatReadReceiptsToPrivacyDraft1797500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, EDITS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(
      queryRunner,
      EDITS.map(([before, after]) => [after, before] as const),
    );
  }

  // Una sola consulta: los reemplazos uno dentro de otro, en orden
  private async apply(
    queryRunner: QueryRunner,
    edits: readonly (readonly [string, string])[],
  ): Promise<void> {
    let content = 'content';
    const params: string[] = [];
    for (const [from, to] of edits) {
      params.push(from, to);
      content = `replace(${content}, $${params.length - 1}, $${params.length})`;
    }
    await queryRunner.query(
      `UPDATE legal_documents SET content = ${content}
        WHERE type = 'privacy' AND status = 'draft'`,
      params,
    );
  }
}
