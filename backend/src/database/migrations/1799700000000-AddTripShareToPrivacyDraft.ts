import { MigrationInterface, QueryRunner } from 'typeorm';

// Compartir el viaje en directo en el borrador de la Política de privacidad
// 1.1 (cambio menor, pendiente de revisar con el director): el pasajero puede
// enviar a alguien de su confianza un enlace con el viaje (y la posición del
// conductor mientras está en curso). Base: interés legítimo en la seguridad
// del pasajero (artículo 6.1.f del RGPD). Cambia las frases que decían que la
// posición del conductor solo la ven sus pasajeros y que no se cede a nadie.
// Solo cambia el borrador (una versión publicada no se puede cambiar) y solo
// donde encuentra el texto previo: si se editó desde el panel, lo deja
const SHARE_SECTION =
  '<h2>Compartir el viaje en directo</h2>\n<p>\n  Por tu seguridad, si viajas como pasajero con la plaza aceptada puedes compartir tu viaje con\n  alguien de tu confianza mediante un enlace secreto que se abre sin cuenta. Quien lo abre ve el\n  estado del viaje (esperando la recogida, en el coche o terminado), tu punto y hora de recogida, el\n  destino y la llegada estimada, el nombre de pila del conductor y su coche (marca, modelo, color y\n  matrícula) y, solo mientras el viaje está en curso, la posición del coche y el recorrido en el\n  mapa. Nunca ve teléfonos, ni a los demás pasajeros, ni sus puntos de recogida.\n</p>\n<p>\n  Se basa en el interés legítimo en la seguridad de los pasajeros (artículo 6.1.f del RGPD). Si\n  conduces, tus pasajeros pueden compartir así el viaje, y puedes oponerte escribiéndonos.\n</p>\n<p>\n  El enlace funciona desde que se acepta la plaza. Al terminar o cancelarse el viaje deja de mostrar\n  la posición y la matrícula, y a las 24 horas deja de funcionar. Puedes dejar de compartir cuando\n  quieras y el enlace deja de funcionar al momento. Solo guardamos una huella del enlace, nunca el\n  enlace.\n</p>\n\n';

const EDITS: readonly (readonly [string, string])[] = [
  [
    '    Si conduces, tu ubicación solo la ven tus pasajeros y solo mientras dura el viaje; el recorrido\n    se borra al terminarlo.',
    '    Si conduces, tu ubicación solo la ven tus pasajeros (y quien ellos elijan con el enlace del viaje\n    en directo) y solo mientras dura el viaje; el recorrido se borra al terminarlo.',
  ],
  [
    '  <li>La posición del conductor durante el viaje solo la ven sus pasajeros aceptados.</li>',
    '  <li>\n    La posición del conductor durante el viaje la ven sus pasajeros aceptados y, si un pasajero\n    comparte el viaje en directo, la persona a la que envía el enlace (ver «Compartir el viaje en\n    directo»).\n  </li>',
  ],
  [
    '    No se venden ni se ceden a terceros. Para las notificaciones push',
    '    No se venden ni se ceden a terceros: el enlace del viaje en directo lo envía el propio pasajero\n    a quien elige. Para las notificaciones push',
  ],
  [
    '<h2>Verificación del teléfono</h2>',
    `${SHARE_SECTION}<h2>Verificación del teléfono</h2>`,
  ],
];

const SUMMARY_BEFORE = ' y cómo ejercer tus derechos.';
const SUMMARY_AFTER =
  ', cómo ejercer tus derechos y que, por tu seguridad, como pasajero puedes compartir el viaje en directo con alguien de tu confianza.';

export class AddTripShareToPrivacyDraft1799700000000 implements MigrationInterface {
  name = 'AddTripShareToPrivacyDraft1799700000000';

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
    // Al aplicar, no dos veces: si un texto nuevo ya está, ese no se toca (al
    // deshacer no se comprueba: algunos textos antiguos siguen dentro del nuevo)
    isOnce: boolean,
  ): Promise<void> {
    // Una sola consulta: los reemplazos uno dentro de otro, en orden
    let content = 'content';
    const params: string[] = [];
    for (const [from, to] of edits) {
      params.push(from, to);
      const [fromParam, toParam] = [
        `$${params.length - 1}`,
        `$${params.length}`,
      ];
      const replaced = `replace(${content}, ${fromParam}, ${toParam})`;
      content = isOnce
        ? `CASE WHEN strpos(${content}, ${toParam}) = 0 THEN ${replaced} ELSE ${content} END`
        : replaced;
    }
    await queryRunner.query(
      `UPDATE legal_documents SET content = ${content}
        WHERE type = 'privacy' AND status = 'draft'`,
      params,
    );
    await queryRunner.query(
      `UPDATE legal_documents SET summary = replace(summary, $1, $2)
        WHERE type = 'privacy' AND status = 'draft'
          AND strpos(summary, $2) = 0`,
      [summaryFrom, summaryTo],
    );
  }
}
