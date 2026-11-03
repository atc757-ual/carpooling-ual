import { MigrationInterface, QueryRunner } from 'typeorm';

// El consentimiento de ubicación pasa a ser un documento versionado (tipo
// location), como el resto de lo que se acepta: su texto se edita y se
// publica desde el panel y cada aceptación guarda su versión. Su 1.0 recoge lo
// que ya explicaban las ventanas de la app. Los consentimientos ya dados
// guardaban la versión de la política (la 1.0), así que cuentan como
// aceptación de esta 1.0 sin tocarlos
const LOCATION_1_0 =
  '<p>Si nos dejas, usamos la ubicación de tu dispositivo para:</p>\n<ul>\n  <li>Rellenar de dónde sales al buscar o publicar un viaje («Usar mi ubicación»).</li>\n  <li>Proponerte volver a casa si estás en el campus.</li>\n  <li>Mostrarte en el mapa del viaje en curso dónde estás respecto al conductor.</li>\n</ul>\n<p>\n  Solo la usamos en el momento: no la guardamos ni la compartimos con otros usuarios. Es un\n  consentimiento (artículo 6.1.a del RGPD): puedes retirarlo cuando quieras en Mi perfil →\n  Privacidad, y la app seguirá funcionando escribiendo las direcciones.\n</p>\n<p>\n  La ubicación del conductor durante su viaje en curso no depende de este consentimiento: forma\n  parte del servicio (artículo 6.1.b), como explica la Política de privacidad.\n</p>';

export class AddLocationConsentDocument1796900000000 implements MigrationInterface {
  name = 'AddLocationConsentDocument1796900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_type_check;
      ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_type_check
        CHECK (type IN ('terms', 'privacy', 'driver_declaration', 'vehicle_declaration', 'location'));
    `);
    await queryRunner.query(
      `INSERT INTO legal_documents
         (type, version, content, status, change_type, published_at)
       VALUES ('location', '1.0', $1, 'published', 'major', now())`,
      [LOCATION_1_0],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM events WHERE source_entity_id IN (
        SELECT id FROM legal_documents WHERE type = 'location');
      DELETE FROM legal_documents WHERE type = 'location';
      ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_type_check;
      ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_type_check
        CHECK (type IN ('terms', 'privacy', 'driver_declaration', 'vehicle_declaration'));
    `);
  }
}
