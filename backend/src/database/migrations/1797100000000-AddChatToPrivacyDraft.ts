import { MigrationInterface, QueryRunner } from 'typeorm';

// Añade al borrador de la Política de privacidad 1.1, pendiente de revisar con
// el director, el chat del viaje (#191-#196: qué se guarda, quién lo ve, que
// los mensajes se borran a los 30 días del viaje y que la copia de un mensaje
// denunciado se conserva con su incidencia) y las notificaciones push
// (opcionales, con Firebase Cloud Messaging de Google como encargado del
// tratamiento). Solo cambia el borrador (una
// versión publicada no se puede cambiar) y solo donde encuentra el texto de
// la migración AddPrivacyPolicyDraft: si se editó desde el panel, lo deja
const EDITS: readonly (readonly [string, string])[] = [
  [
    '  <li>Incidencias que registres y su revisión.</li>',
    '  <li>Los mensajes del chat de cada viaje y las denuncias de mensajes.</li>\n  <li>\n    Si activas las notificaciones push, el identificador de tu dispositivo o navegador para\n    enviártelas.\n  </li>\n  <li>Incidencias que registres y su revisión.</li>',
  ],
  [
    '<h2>Verificación del teléfono</h2>',
    '<h2>Chat del viaje</h2>\n<p>\n  El conductor y los pasajeros aceptados de un viaje pueden escribirse en su chat, para concretar\n  la recogida, desde que hay pasajeros hasta 24 horas después del viaje. Es parte del servicio\n  (artículo 6.1.b del RGPD). Si un mensaje te parece inapropiado puedes denunciarlo: la\n  administración recibe una copia del mensaje y tu motivo, y quien lo escribió no sabe quién lo\n  denunció.\n</p>\n\n<h2>Notificaciones push</h2>\n<p>\n  Si las activas (en <strong>Mi perfil</strong> y con el permiso de tu dispositivo o navegador), te\n  avisamos aunque tengas la app cerrada de lo importante de tus viajes: solicitudes, plazas\n  aceptadas o rechazadas, viajes cancelados o iniciados y mensajes nuevos del chat. El aviso de un\n  mensaje dice quién te ha escrito, no lo que dice. Se envían con Firebase Cloud Messaging, un\n  servicio de Google que actúa como encargado del tratamiento y solo recibe el identificador de tu\n  dispositivo y el aviso. Puedes desactivarlas cuando quieras en <strong>Mi perfil</strong> o en\n  los ajustes del dispositivo; al desactivarlas o cerrar sesión se borra el identificador.\n</p>\n\n<h2>Verificación del teléfono</h2>',
  ],
  [
    '  <li>La posición del conductor durante el viaje solo la ven sus pasajeros aceptados.</li>',
    '  <li>La posición del conductor durante el viaje solo la ven sus pasajeros aceptados.</li>\n  <li>\n    Los mensajes del chat de un viaje solo los ven su conductor y sus pasajeros aceptados; los\n    denunciados, también la administración.\n  </li>',
  ],
  [
    '  <li>No se ceden a terceros.</li>',
    '  <li>\n    No se ceden a terceros. Para las notificaciones push usamos Firebase Cloud Messaging (Google)\n    como encargado del tratamiento.\n  </li>',
  ],
  [
    'Mientras tengas la cuenta. El recorrido de un viaje se borra al terminarlo o cancelarlo.',
    'Mientras tengas la cuenta. El recorrido de un viaje se borra al terminarlo o cancelarlo. Los\n  mensajes del chat se borran 30 días después de terminar o cancelar el viaje; la copia de un\n  mensaje denunciado se conserva con su incidencia mientras haga falta para revisarla.',
  ],
];

const SUMMARY_BEFORE = 'y qué pasa con tus datos al eliminar la cuenta.';
const SUMMARY_AFTER =
  'qué pasa con tus datos al eliminar la cuenta, cómo funciona el chat del viaje (quién ve los mensajes y cuándo se borran) y las notificaciones push (opcionales, con Firebase Cloud Messaging de Google).';

export class AddChatToPrivacyDraft1797100000000 implements MigrationInterface {
  name = 'AddChatToPrivacyDraft1797100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, EDITS, [SUMMARY_BEFORE, SUMMARY_AFTER], true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(
      queryRunner,
      EDITS.map(([before, after]) => [after, before] as const),
      [SUMMARY_AFTER, SUMMARY_BEFORE],
      false,
    );
  }

  private async apply(
    queryRunner: QueryRunner,
    edits: readonly (readonly [string, string])[],
    [summaryFrom, summaryTo]: readonly [string, string],
    // Al aplicar, no dos veces: si el texto nuevo ya está, no se toca (al
    // deshacer no hace falta: el texto nuevo contiene el antiguo)
    isOnce: boolean,
  ): Promise<void> {
    const once = isOnce ? 'AND strpos(content, $2) = 0' : '';
    for (const [from, to] of edits) {
      await queryRunner.query(
        `UPDATE legal_documents SET content = replace(content, $1, $2)
          WHERE type = 'privacy' AND status = 'draft' ${once}`,
        [from, to],
      );
    }
    await queryRunner.query(
      `UPDATE legal_documents SET summary = replace(summary, $1, $2)
        WHERE type = 'privacy' AND status = 'draft'`,
      [summaryFrom, summaryTo],
    );
  }
}
