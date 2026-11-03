import { MigrationInterface, QueryRunner } from 'typeorm';

// Borrador de la Política de privacidad 1.1 (cambio menor), pendiente de
// revisar con el director antes de publicarlo desde el panel (al publicarlo
// se avisa a cada usuario en Avisos). Lo que cambia frente a la 1.0:
// - La ubicación del conductor con el viaje en curso se trata por la
//   ejecución del servicio (artículo 6.1.b del RGPD), no por consentimiento:
//   sin ella no se puede iniciar el viaje
// - La del pasajero y la de buscar o publicar siguen siendo opcionales, con
//   consentimiento (artículo 6.1.a)
// - Eliminar la cuenta la desactiva: qué se conserva y para qué
// Se crea solo si no hay ya un borrador; su versión es la siguiente menor a
// la vigente
const SUMMARY =
  'Explicamos que compartir tu ubicación como conductor mientras el viaje está en curso es parte del servicio (sin ella no se puede iniciar), que la ubicación en los demás casos sigue siendo opcional y qué pasa con tus datos al eliminar la cuenta.';

const PRIVACY_1_1 =
  '<p>Texto provisional, pendiente de revisión.</p>\n\n<h2>Responsable</h2>\n<p>\n  Universidad de Almería (pendiente de confirmar los datos de contacto y del Delegado de Protección\n  de Datos).\n</p>\n\n<h2>Qué datos tratamos</h2>\n<ul>\n  <li>\n    Cuenta: nombre, correo institucional, teléfono y contraseña (guardada cifrada, nunca en claro).\n  </li>\n  <li>Perfil público: avatar, «Sobre mí», preferencias de viaje y las reseñas que recibes.</li>\n  <li>\n    Viajes: origen, destino, horarios, plazas, vehículo (marca, modelo, matrícula y capacidad),\n    solicitudes y puntos de recogida.\n  </li>\n  <li>\n    Si conduces: tu posición mientras el viaje está en curso, también con la app en segundo plano\n    (ver «Ubicación del conductor durante el viaje»).\n  </li>\n  <li>En los demás casos, tu ubicación solo si das tu consentimiento (ver «Tu ubicación»).</li>\n  <li>Incidencias que registres y su revisión.</li>\n  <li>Registro de tus consentimientos (ver «Registro de consentimientos»).</li>\n</ul>\n\n<h2>Para qué y con qué base</h2>\n<p>\n  Para gestionar tu cuenta y los viajes compartidos, incluida la posición de quien conduce mientras\n  el viaje está en curso: es necesario para prestarte el servicio (artículo 6.1.b del RGPD). Los\n  datos de uso, sin identificar a nadie, se usan para medir el impacto (vehículos evitados) y para\n  las simulaciones del proyecto.\n</p>\n\n<h2>Ubicación del conductor durante el viaje</h2>\n<p>\n  Para iniciar un viaje como conductor hay que compartir la ubicación: los pasajeros aceptados ven\n  dónde está el coche y cuánto falta, y al terminar la app comprueba si estás cerca del destino. Es\n  parte del servicio que se presta (artículo 6.1.b del RGPD), así que no se pide un consentimiento\n  aparte, pero sí el permiso de tu dispositivo: sin él no se puede iniciar el viaje.\n</p>\n<p>\n  La posición se envía cada pocos segundos solo mientras el viaje está en curso, también con la app\n  en segundo plano en el móvil, con un aviso visible mientras se comparte. Deja de enviarse al\n  terminar o cancelar el viaje y el recorrido se borra entonces; solo se guarda a cuántos metros del\n  destino terminó.\n</p>\n\n<h2>Tu ubicación</h2>\n<p>\n  En los demás casos la app solo usa tu ubicación si das tu consentimiento (artículo 6.1.a del RGPD)\n  y, además, el permiso de tu dispositivo. Sirve para proponerte un origen cercano al buscar o\n  publicar y, si viajas como pasajero, para seguir el viaje en el mapa y saber si ya estás junto al\n  coche. Solo se envía el punto que eliges como origen o recogida.\n</p>\n<p>\n  Puedes retirar el consentimiento cuando quieras en <strong>Mi perfil</strong>, sin que afecte a lo\n  tratado antes. Si quitas el permiso en el dispositivo, la app lo detecta y lo registra como\n  retirado. Sin ubicación puedes seguir usando la app escribiendo las direcciones.\n</p>\n\n<h2>Verificación del teléfono</h2>\n<p>\n  Para verificar tu teléfono te enviamos un SMS con un código de un solo uso, que caduca a los pocos\n  minutos. Si cambias el número, hay que verificarlo de nuevo.\n</p>\n\n<h2>Quién los ve</h2>\n<ul>\n  <li>\n    Tu perfil público lo ven los demás usuarios cuando coincidís en un viaje o en una búsqueda.\n  </li>\n  <li>\n    Tu nombre y tu teléfono solo los ven el conductor y los pasajeros aceptados de un viaje, y la\n    administración cuando revisa una incidencia.\n  </li>\n  <li>La posición del conductor durante el viaje solo la ven sus pasajeros aceptados.</li>\n  <li>No se ceden a terceros.</li>\n</ul>\n\n<h2>Registro de consentimientos</h2>\n<p>\n  Guardamos cuándo aceptas las condiciones de uso, cuándo lees esta política y cuándo das o retiras\n  el consentimiento de ubicación: el documento y su versión exacta, una huella de su texto, la\n  fecha, desde dónde se hizo y una huella que impide modificar el registro. Sirve para demostrar tu\n  consentimiento (artículo 7.1 del RGPD). Cuando cambiamos estos textos te lo contamos en la app y,\n  si el cambio afecta a lo que aceptaste, te pedimos que lo aceptes de nuevo.\n</p>\n\n<h2>Cuánto tiempo</h2>\n<p>\n  Mientras tengas la cuenta. El recorrido de un viaje se borra al terminarlo o cancelarlo.\n</p>\n<p>\n  Eliminar la cuenta la desactiva: deja de verse, no se puede volver a entrar y se retiran tus\n  consentimientos. Tus datos se conservan bloqueados, sin usarse para nada más, solo para atender\n  posibles responsabilidades (por ejemplo, una incidencia o una reclamación) durante los plazos\n  legales; después se borran o se anonimizan. El registro de consentimientos se conserva como\n  prueba. (Plazos concretos pendientes de fijar con la Universidad.)\n</p>\n\n<h2>Tus derechos</h2>\n<p>\n  Puedes pedir el acceso, la rectificación, la supresión, la limitación, la portabilidad y la\n  oposición, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).\n</p>';

export class AddPrivacyPolicyDraft1796300000000 implements MigrationInterface {
  name = 'AddPrivacyPolicyDraft1796300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO legal_documents (type, version, content, status, change_type, summary)
       SELECT 'privacy',
              split_part(current.version, '.', 1) || '.' ||
                (split_part(current.version, '.', 2)::int + 1),
              $1, 'draft', 'minor', $2
         FROM (SELECT version FROM legal_documents
                WHERE type = 'privacy' AND status = 'published'
                ORDER BY published_at DESC LIMIT 1) AS current
        WHERE NOT EXISTS (
          SELECT 1 FROM legal_documents WHERE type = 'privacy' AND status = 'draft')`,
      [PRIVACY_1_1, SUMMARY],
    );
  }

  // Solo se quita el borrador si sigue siendo este (no si ya se publicó o se
  // cambió en el panel)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM legal_documents
        WHERE type = 'privacy' AND status = 'draft' AND summary = $1`,
      [SUMMARY],
    );
  }
}
