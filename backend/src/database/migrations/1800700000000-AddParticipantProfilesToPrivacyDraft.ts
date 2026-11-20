import { MigrationInterface, QueryRunner } from 'typeorm';

// Borrador de la Política de privacidad 1.2: quien conduce y sus pasajeros se
// ven el uno al otro el nombre completo, el correo institucional, el avatar y
// el «Sobre mí» desde que se acepta la plaza (también después del viaje), y
// el teléfono verificado solo con el viaje en curso. Parte del servicio
// (artículo 6.1.b del RGPD): saber con quién se viaja.
// Solo toca el borrador (la 1.1 publicada no cambia) y cada texto solo si
// encuentra el de las migraciones anteriores: si se editó desde el panel, se
// queda como está y se cambia allí
const WHO_SEES_ES = [
  '    Tu nombre y tu teléfono solo los ven el conductor y los pasajeros aceptados de un viaje, y la\n    administración cuando revisa una incidencia.',
  '    Tu nombre completo, tu correo institucional, tu avatar y tu «Sobre mí» los ven quien conduce y\n    los pasajeros con plaza en tu viaje (los pasajeros no se ven entre ellos), desde que se acepta la\n    plaza y también después del viaje. Tu teléfono verificado, solo mientras el viaje está en curso.\n    La administración los ve cuando revisa una incidencia.',
];

const WHO_SEES_EN = [
  '    Your name and phone number are only seen by the driver and the accepted passengers of a trip, and\n    by the administration when it reviews an incident.',
  '    Your full name, institutional email address, avatar and "About me" are seen by the driver and the\n    passengers with a seat on your trip (passengers cannot see each other), from when the seat is\n    accepted and also after the trip. Your verified phone number, only while the trip is in progress.\n    The administration sees them when it reviews an incident.',
];

const SUMMARY_ES = [
  'Explicamos los correos que te enviamos en cada viaje (al confirmarse tu plaza y al terminar, con el enlace para valorar) y que el chat del viaje es directo entre quien conduce y cada pasajero.',
  'Explicamos los correos que te enviamos en cada viaje (al confirmarse tu plaza y al terminar, con el enlace para valorar), que el chat del viaje es directo entre quien conduce y cada pasajero y que los dos se ven el nombre completo, el correo y el «Sobre mí» (el teléfono, solo con el viaje en curso).',
];

const SUMMARY_EN = [
  'We explain the emails we send you on each trip (when your seat is confirmed and when it ends, with the link to review it) and that the trip chat is direct between whoever drives and each passenger.',
  'We explain the emails we send you on each trip (when your seat is confirmed and when it ends, with the link to review it), that the trip chat is direct between whoever drives and each passenger and that both see each other\'s full name, email and "About me" (the phone number, only while the trip is in progress).',
];

const DRAFT = "type = 'privacy' AND status = 'draft'";

export class AddParticipantProfilesToPrivacyDraft1800700000000 implements MigrationInterface {
  name = 'AddParticipantProfilesToPrivacyDraft1800700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 0, 1);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, 1, 0);
  }

  // Cambia cada texto del borrador de la versión «from» a la «to»
  private async apply(
    queryRunner: QueryRunner,
    from: number,
    to: number,
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE legal_documents
          SET content = replace(content, $1, $2)
        WHERE ${DRAFT} AND position($1 in content) > 0`,
      [WHO_SEES_ES[from], WHO_SEES_ES[to]],
    );
    await queryRunner.query(
      `UPDATE legal_documents
          SET content_en = replace(content_en, $1, $2)
        WHERE ${DRAFT} AND position($1 in content_en) > 0`,
      [WHO_SEES_EN[from], WHO_SEES_EN[to]],
    );
    await queryRunner.query(
      `UPDATE legal_documents
          SET summary = CASE WHEN summary = $1 THEN $2 ELSE summary END,
              summary_en = CASE WHEN summary_en = $3 THEN $4 ELSE summary_en END
        WHERE ${DRAFT}`,
      [SUMMARY_ES[from], SUMMARY_ES[to], SUMMARY_EN[from], SUMMARY_EN[to]],
    );
  }
}
