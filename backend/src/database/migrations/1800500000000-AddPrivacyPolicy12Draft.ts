import { MigrationInterface, QueryRunner } from 'typeorm';

// Borrador de la Política de privacidad 1.2 (cambio menor), pendiente de
// revisar con el director antes de publicarlo desde el panel (al publicarlo
// se avisa a cada usuario en Avisos). Copia la vigente (1.1) con dos cambios:
// - Los correos del viaje al pasajero: al confirmarse su plaza y al terminar
//   el viaje, con el enlace para valorar (#342). Parte del servicio
//   (artículo 6.1.b del RGPD), sin publicidad
// - El chat del viaje es directo entre quien conduce y cada pasajero (#317) y
//   queda solo para leer cuando el pasajero se baja (#335): la 1.1 aún decía
//   que lo veían todos los del viaje
// Se crea solo si no hay ya un borrador; su versión es la siguiente menor a
// la vigente. Cada cambio se aplica solo si encuentra el texto de la 1.1: si
// se editó desde el panel, ese no se toca
const SUMMARY =
  'Explicamos los correos que te enviamos en cada viaje (al confirmarse tu plaza y al terminar, con el enlace para valorar) y que el chat del viaje es directo entre quien conduce y cada pasajero.';

const EMAILS_SECTION =
  '<h2>Correos del viaje</h2>\n<p>\n  Además de los correos de tu cuenta (el código para entrar o recuperar la contraseña), te\n  escribimos a tu correo institucional en dos momentos de cada viaje como pasajero: cuando se\n  confirma tu plaza (con el trayecto, la hora, el punto de recogida y quién conduce) y cuando termina\n  tu viaje (con el enlace para valorarlo en los 7 días siguientes). Es parte del servicio (artículo\n  6.1.b del RGPD) y no incluye publicidad. Se envían con el servidor de correo del servicio (el de la\n  Universidad o un proveedor que actúe como encargado del tratamiento, pendiente de fijar).\n</p>\n\n';

const EDITS: readonly (readonly [string, string])[] = [
  [
    '  El conductor y los pasajeros aceptados de un viaje pueden escribirse en su chat, para concretar\n  la recogida, desde que hay pasajeros hasta 24 horas después del viaje.',
    '  El conductor puede escribirse con cada pasajero aceptado en un chat de los dos (los demás\n  pasajeros no lo ven), para concretar la recogida, desde que hay pasajeros hasta 24 horas después\n  del viaje. Cuando el pasajero se baja, ese chat queda solo para leer.',
  ],
  [
    'permitiendo a quien escribió saber si todos han leído su mensaje (confirmación de lectura).',
    'permitiendo a quien escribió saber si la otra persona ha leído su mensaje (confirmación de\n  lectura).',
  ],
  [
    '    Los mensajes del chat de un viaje solo los ven su conductor y sus pasajeros aceptados; si se\n    denuncia el chat, también la administración.',
    '    Los mensajes de cada chat solo los ven el conductor y el pasajero de esa conversación (los del\n    chat común anterior, sus participantes); si se denuncia, también la administración.',
  ],
  [
    '<h2>Compartir el viaje en directo</h2>',
    `${EMAILS_SECTION}<h2>Compartir el viaje en directo</h2>`,
  ],
];

export class AddPrivacyPolicy12Draft1800500000000 implements MigrationInterface {
  name = 'AddPrivacyPolicy12Draft1800500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Los reemplazos uno dentro de otro, en orden, sobre el texto vigente
    let content = 'current.content';
    const params: string[] = [SUMMARY];
    for (const [from, to] of EDITS) {
      params.push(from, to);
      content = `replace(${content}, $${params.length - 1}, $${params.length})`;
    }
    await queryRunner.query(
      `INSERT INTO legal_documents (type, version, content, status, change_type, summary)
       SELECT 'privacy',
              split_part(current.version, '.', 1) || '.' ||
                (split_part(current.version, '.', 2)::int + 1),
              ${content}, 'draft', 'minor', $1
         FROM (SELECT version, content FROM legal_documents
                WHERE type = 'privacy' AND status = 'published'
                ORDER BY published_at DESC LIMIT 1) AS current
        WHERE NOT EXISTS (
          SELECT 1 FROM legal_documents WHERE type = 'privacy' AND status = 'draft')`,
      params,
    );
  }

  // Solo se quita el borrador si sigue siendo este (no si ya se publicó o se
  // cambió el resumen en el panel)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM legal_documents
        WHERE type = 'privacy' AND status = 'draft' AND summary = $1`,
      [SUMMARY],
    );
  }
}
