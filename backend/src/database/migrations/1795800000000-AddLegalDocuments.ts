import { MigrationInterface, QueryRunner } from 'typeorm';

// Documentos legales con versiones (panel de administración):
// - legal_documents: cada versión de las condiciones de uso y de la política
//   de privacidad, en borrador o publicada (HTML ya saneado). Una sola en
//   borrador por documento; la publicada más reciente es la vigente
// - La versión 1.0 de los dos, con el texto que tenía la app
//   (frontend/public/legal), publicada
// - consent_source: document_update, al aceptar una versión nueva
const TERMS_1_0 =
  '<p>Texto provisional, pendiente de revisión.</p>\n\n<h2>1. Qué es UAL Carpool</h2>\n<p>\n  UAL Carpool es una plataforma para compartir trayectos en coche entre personas de la comunidad\n  de la Universidad de Almería. No es un servicio de transporte: quien conduce comparte su propio\n  viaje y los gastos, sin ánimo de lucro.\n</p>\n\n<h2>2. Quién puede usarla</h2>\n<p>\n  Personas con un correo institucional de la Universidad de Almería verificado. Verificar el\n  correo no acredita la identidad, el vehículo ni el permiso de conducir.\n</p>\n\n<h2>3. Compromisos de quien conduce</h2>\n<ul>\n  <li>Tener el permiso de conducir en vigor y el vehículo en condiciones (declaración responsable).</li>\n  <li>Ofrecer solo las plazas que permite el vehículo.</li>\n  <li>Avisar con tiempo si cancela un viaje.</li>\n</ul>\n\n<h2>4. Compromisos de quien viaja</h2>\n<ul>\n  <li>Estar en el punto de recogida a la hora acordada.</li>\n  <li>Cancelar la solicitud si ya no va a viajar.</li>\n</ul>\n\n<h2>5. Convivencia</h2>\n<p>\n  Trato respetuoso, sin discriminación. Las incidencias se pueden registrar en la app y las\n  revisa la administración.\n</p>';

const PRIVACY_1_0 =
  '<p>Texto provisional, pendiente de revisión.</p>\n\n<h2>Responsable</h2>\n<p>\n  Universidad de Almería (pendiente de confirmar los datos de contacto y del Delegado de Protección\n  de Datos).\n</p>\n\n<h2>Qué datos tratamos</h2>\n<ul>\n  <li>\n    Cuenta: nombre, correo institucional, teléfono y contraseña (guardada cifrada, nunca en claro).\n  </li>\n  <li>Perfil público: avatar, «Sobre mí», preferencias de viaje y las reseñas que recibes.</li>\n  <li>\n    Viajes: origen, destino, horarios, plazas, vehículo (marca, modelo, matrícula y capacidad),\n    solicitudes y puntos de recogida.\n  </li>\n  <li>Posición del conductor solo mientras el viaje está en curso; se borra al terminar.</li>\n  <li>Tu ubicación, solo si das tu consentimiento (ver «Ubicación»).</li>\n  <li>Incidencias que registres y su revisión.</li>\n  <li>Registro de tus consentimientos (ver «Registro de consentimientos»).</li>\n</ul>\n\n<h2>Para qué y con qué base</h2>\n<p>\n  Para gestionar tu cuenta y los viajes compartidos: es necesario para prestarte el servicio\n  (artículo 6.1.b del RGPD). Los datos de uso, sin identificar a nadie, se usan para medir el\n  impacto (vehículos evitados) y para las simulaciones del proyecto.\n</p>\n\n<h2>Ubicación</h2>\n<p>\n  La app solo usa tu ubicación si das tu consentimiento (artículo 6.1.a del RGPD) y, además, el\n  permiso de tu dispositivo. Sirve para proponerte un origen cercano al buscar o publicar y, durante\n  un viaje, para saber si ya estás junto al coche. Solo se envía el punto que eliges como origen o\n  recogida.\n</p>\n<p>\n  Puedes retirar el consentimiento cuando quieras en <strong>Mi perfil</strong>, sin que afecte a lo\n  tratado antes. Si quitas el permiso en el dispositivo, la app lo detecta y lo registra como\n  retirado. Sin ubicación puedes seguir usando la app escribiendo las direcciones.\n</p>\n\n<h2>Verificación del teléfono</h2>\n<p>\n  Para verificar tu teléfono te enviamos un SMS con un código de un solo uso, que caduca a los pocos\n  minutos. Si cambias el número, hay que verificarlo de nuevo.\n</p>\n\n<h2>Quién los ve</h2>\n<ul>\n  <li>\n    Tu perfil público lo ven los demás usuarios cuando coincidís en un viaje o en una búsqueda.\n  </li>\n  <li>\n    Tu nombre y tu teléfono solo los ven el conductor y los pasajeros aceptados de un viaje, y la\n    administración cuando revisa una incidencia.\n  </li>\n  <li>No se ceden a terceros.</li>\n</ul>\n\n<h2>Registro de consentimientos</h2>\n<p>\n  Guardamos cuándo aceptas las condiciones de uso, cuándo lees esta política y cuándo das o retiras\n  el consentimiento de ubicación: el documento y su versión, la fecha, desde dónde se hizo y una\n  huella que impide modificar el registro. Sirve para demostrar tu consentimiento (artículo 7.1 del\n  RGPD).\n</p>\n\n<h2>Cuánto tiempo</h2>\n<p>\n  Mientras tengas la cuenta. El recorrido detallado de un viaje se borra al terminarlo. Al eliminar\n  la cuenta, deja de verse, se retiran tus consentimientos y su registro se conserva como prueba.\n</p>\n\n<h2>Tus derechos</h2>\n<p>\n  Puedes pedir el acceso, la rectificación, la supresión, la limitación, la portabilidad y la\n  oposición, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).\n</p>';

export class AddLegalDocuments1795800000000 implements MigrationInterface {
  name = 'AddLegalDocuments1795800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE legal_documents (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type         varchar(20) NOT NULL CHECK (type IN ('terms', 'privacy')),
        version      varchar(20) NOT NULL CHECK (version ~ '^[0-9]+[.][0-9]+$'),
        content      text NOT NULL,
        status       varchar(20) NOT NULL CHECK (status IN ('draft', 'published')),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz NULL,
        published_by uuid NULL REFERENCES users (id),
        UNIQUE (type, version),
        CHECK ((status = 'published') = (published_at IS NOT NULL))
      );
      CREATE UNIQUE INDEX legal_documents_one_draft_idx
        ON legal_documents (type) WHERE status = 'draft';

      ALTER TYPE consent_source ADD VALUE IF NOT EXISTS 'document_update';
    `);
    await queryRunner.query(
      `INSERT INTO legal_documents (type, version, content, status, published_at)
       VALUES ('terms', '1.0', $1, 'published', now()),
              ('privacy', '1.0', $2, 'published', now())`,
      [TERMS_1_0, PRIVACY_1_0],
    );
  }

  // El valor document_update del tipo consent_source se queda (PostgreSQL no
  // permite quitar valores de un enum)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE legal_documents');
  }
}
