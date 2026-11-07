import { MigrationInterface, QueryRunner } from 'typeorm';

// En el borrador de la Política de privacidad 1.1 (pendiente de revisar con el
// director), la denuncia pasa de un mensaje a la conversación del chat: la
// administración recibe una copia de la conversación y el motivo, y la copia
// se conserva con su incidencia. Solo cambia el borrador (una versión
// publicada no se puede cambiar) y solo donde encuentra el texto de la
// migración AddChatToPrivacyDraft: si se editó desde el panel, lo deja
const EDITS: readonly (readonly [string, string])[] = [
  [
    '  <li>Los mensajes del chat de cada viaje y las denuncias de mensajes.</li>',
    '  <li>Los mensajes del chat de cada viaje y las denuncias de esos chats.</li>',
  ],
  [
    'Si un mensaje te parece inapropiado puedes denunciarlo: la\n  administración recibe una copia del mensaje y tu motivo, y quien lo escribió no sabe quién lo\n  denunció.',
    'Si la conversación te parece inapropiada puedes denunciarla: la\n  administración recibe una copia de la conversación y tu motivo, y nadie del viaje sabe quién la\n  denunció.',
  ],
  [
    'Los mensajes del chat de un viaje solo los ven su conductor y sus pasajeros aceptados; los\n    denunciados, también la administración.',
    'Los mensajes del chat de un viaje solo los ven su conductor y sus pasajeros aceptados; si se\n    denuncia el chat, también la administración.',
  ],
  [
    'la copia de un\n  mensaje denunciado se conserva con su incidencia mientras haga falta para revisarla.',
    'la copia de una\n  conversación denunciada se conserva con su incidencia mientras haga falta para revisarla.',
  ],
];

export class ReportChatInPrivacyDraft1797300000000 implements MigrationInterface {
  name = 'ReportChatInPrivacyDraft1797300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, EDITS);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(
      queryRunner,
      EDITS.map(([before, after]) => [after, before] as const),
    );
  }

  // Una sola consulta: los reemplazos uno dentro de otro, en orden (ningún
  // texto nuevo contiene el antiguo: aplicarlo dos veces no cambia nada)
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
