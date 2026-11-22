import { MigrationInterface, QueryRunner } from 'typeorm';

// Borrador de la Política de privacidad 1.2: el teléfono es opcional y la
// otra persona del viaje solo lo ve (para llamar con el viaje en curso) si
// quien viaja decide compartirlo. Solo toca el borrador (la 1.1 publicada no
// cambia) y cada texto solo si encuentra el de las migraciones anteriores: si
// se editó desde el panel, se queda como está y se cambia allí
const TEXTS: readonly {
  column: 'content' | 'content_en';
  from: string;
  to: string;
}[] = [
  {
    column: 'content',
    from: 'Cuenta: nombre, correo institucional, teléfono y contraseña (guardada cifrada, nunca en claro).',
    to: 'Cuenta: nombre, correo institucional, contraseña (guardada cifrada, nunca en claro) y, si\n    quieres darlo, tu teléfono.',
  },
  {
    column: 'content',
    from: 'Tu teléfono verificado, solo mientras el viaje está en curso.',
    to: 'Tu teléfono verificado, solo si decides compartirlo y mientras el viaje está en curso.',
  },
  {
    column: 'content_en',
    from: 'Account: name, institutional email address, phone number and password (stored encrypted, never in\n    plain text).',
    to: 'Account: name, institutional email address, password (stored encrypted, never in plain text)\n    and, if you choose to give it, your phone number.',
  },
  {
    column: 'content_en',
    from: 'Your verified phone number, only while the trip is in progress.',
    to: 'Your verified phone number, only if you choose to share it and while the trip is in progress.',
  },
];

const SUMMARY_ES = [
  '(el teléfono, solo con el viaje en curso).',
  '(el teléfono, solo si se comparte y con el viaje en curso).',
];

const SUMMARY_EN = [
  '(the phone number, only while the trip is in progress).',
  '(the phone number, only if shared and while the trip is in progress).',
];

const DRAFT = "type = 'privacy' AND status = 'draft'";

export class AddPhoneSharingToPrivacyDraft1800800000001 implements MigrationInterface {
  name = 'AddPhoneSharingToPrivacyDraft1800800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.apply(queryRunner, false);
  }

  // Cambia cada texto del borrador hacia delante (up) o hacia atrás (down)
  private async apply(queryRunner: QueryRunner, isUp: boolean): Promise<void> {
    for (const { column, from, to } of TEXTS) {
      const [search, replacement] = isUp ? [from, to] : [to, from];
      await queryRunner.query(
        `UPDATE legal_documents
            SET ${column} = replace(${column}, $1, $2)
          WHERE ${DRAFT} AND position($1 in ${column}) > 0`,
        [search, replacement],
      );
    }
    const [esFrom, esTo] = isUp ? SUMMARY_ES : [SUMMARY_ES[1], SUMMARY_ES[0]];
    const [enFrom, enTo] = isUp ? SUMMARY_EN : [SUMMARY_EN[1], SUMMARY_EN[0]];
    await queryRunner.query(
      `UPDATE legal_documents
          SET summary = replace(summary, $1, $2),
              summary_en = replace(summary_en, $3, $4)
        WHERE ${DRAFT}`,
      [esFrom, esTo, enFrom, enTo],
    );
  }
}
