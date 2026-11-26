import { MigrationInterface, QueryRunner } from 'typeorm';

// Dos textos de la ayuda que se habían quedado atrás:
// - «¿Qué ven los pasajeros de mí?» decía que el teléfono y el correo no se
//   muestran, pero con la Política de privacidad 1.2 los pasajeros con plaza
//   ven el correo en todos los estados del viaje y el teléfono si se comparte,
//   con el viaje en curso.
// - El tema «Valoraciones» llevaba el pulgar; la escala es de medallas (RF-22).
// Solo si siguen como se crearon: si se cambiaron desde el panel, se dejan
const OLD_ANSWER_ES =
  'Tu nombre, el trayecto, la hora y las plazas libres. Tu teléfono y tu correo no se muestran.';
const OLD_ANSWER_EN =
  'Your name, the route, the time and the free seats. Your phone number and your email are not shown.';
const NEW_ANSWER_ES =
  'Quien busca ve tu nombre, el trayecto, la hora y las plazas libres. Los pasajeros con plaza ven ' +
  'además tu nombre completo, tu correo, tu foto y tu «Sobre mí»; tu teléfono, solo si lo compartes ' +
  'y con el viaje en curso.';
const NEW_ANSWER_EN =
  'Anyone searching sees your name, the route, the time and the free seats. Passengers with a seat ' +
  'also see your full name, your email, your picture and your “About me”; your phone number only if ' +
  'you share it, while the trip is in progress.';

export class UpdatePrivacyFaqAndRatingsIcon1802100000000 implements MigrationInterface {
  name = 'UpdatePrivacyFaqAndRatingsIcon1802100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replaceAnswer(queryRunner, OLD_ANSWER_ES, NEW_ANSWER_ES, 'es');
    await this.replaceAnswer(queryRunner, OLD_ANSWER_EN, NEW_ANSWER_EN, 'en');
    await queryRunner.query(
      `UPDATE faq_topics SET icon = 'medal-outline'
        WHERE key = 'ratings' AND icon = 'thumbs-up-outline'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.replaceAnswer(queryRunner, NEW_ANSWER_ES, OLD_ANSWER_ES, 'es');
    await this.replaceAnswer(queryRunner, NEW_ANSWER_EN, OLD_ANSWER_EN, 'en');
    await queryRunner.query(
      `UPDATE faq_topics SET icon = 'thumbs-up-outline'
        WHERE key = 'ratings' AND icon = 'medal-outline'`,
    );
  }

  private async replaceAnswer(
    queryRunner: QueryRunner,
    from: string,
    to: string,
    language: 'es' | 'en',
  ): Promise<void> {
    const column = language === 'es' ? 'answer_es' : 'answer_en';
    await queryRunner.query(
      `UPDATE faqs SET ${column} = $1 WHERE ${column} = $2`,
      [to, from],
    );
  }
}
