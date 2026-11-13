import { MigrationInterface, QueryRunner } from 'typeorm';

// Lenguaje claro en el borrador de la Política de privacidad 1.1, pendiente de
// revisar con el director (revisión del 12/11/2026, con la estructura de las
// políticas de otros servicios universitarios de carpooling):
// - Un resumen «En pocas palabras» al principio
// - La finalidad, solo el carpooling de la comunidad UAL: sin publicidad ni
//   perfiles comerciales
// - Que los datos no se venden (además de no cederse)
// - Cómo ejercer los derechos (desde «Ayuda y soporte») y en qué plazo
// Solo cambia el borrador (una versión publicada no se puede cambiar) y solo
// donde encuentra el texto previo: si se editó desde el panel, lo deja
const EDITS: readonly (readonly [string, string])[] = [
  [
    '<p>Texto provisional, pendiente de revisión.</p>\n\n<h2>Responsable</h2>',
    '<p>Texto provisional, pendiente de revisión.</p>\n\n<h2>En pocas palabras</h2>\n<ul>\n  <li>Tus datos solo se usan para los viajes compartidos de la comunidad universitaria de la UAL.</li>\n  <li>\n    Si conduces, tu ubicación solo la ven tus pasajeros y solo mientras dura el viaje; el recorrido\n    se borra al terminarlo.\n  </li>\n  <li>No vendemos tus datos ni los usamos para publicidad.</li>\n  <li>Puedes pedir verlos, corregirlos o suprimirlos cuando quieras (ver «Tus derechos»).</li>\n</ul>\n\n<h2>Responsable</h2>',
  ],
  [
    '  las simulaciones del proyecto.\n</p>',
    '  las simulaciones del proyecto.\n</p>\n<p>\n  Solo para eso: no usamos tus datos para publicidad ni para elaborar perfiles comerciales.\n</p>',
  ],
  [
    '    No se ceden a terceros. Para las notificaciones push',
    '    No se venden ni se ceden a terceros. Para las notificaciones push',
  ],
  [
    '  oposición, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).\n</p>',
    '  oposición, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).\n</p>\n<p>\n  Tu perfil y tus preferencias los puedes corregir tú en <strong>Mi perfil</strong>. Para lo demás,\n  escríbenos desde <strong>Ayuda y soporte</strong>, en <strong>Mi perfil</strong>, con el motivo\n  «Mi cuenta»: te responderemos en el plazo de un mes (artículo 12.3 del RGPD).\n</p>',
  ],
];

const SUMMARY_BEFORE =
  ' y las notificaciones push (opcionales, con Firebase Cloud Messaging de Google).';
const SUMMARY_AFTER =
  ', las notificaciones push (opcionales, con Firebase Cloud Messaging de Google) y, al principio, un resumen en pocas palabras: para qué usamos tus datos, que no los vendemos y cómo ejercer tus derechos.';

export class ClarifyPrivacyDraft1799200000000 implements MigrationInterface {
  name = 'ClarifyPrivacyDraft1799200000000';

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
    // deshacer no hace falta: el texto nuevo contiene el antiguo)
    isOnce: boolean,
  ): Promise<void> {
    // Una sola consulta: los reemplazos uno dentro de otro, en orden. Cada uno,
    // al aplicar, solo si su texto nuevo aún no está
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
        WHERE type = 'privacy' AND status = 'draft'`,
      [summaryFrom, summaryTo],
    );
  }
}
