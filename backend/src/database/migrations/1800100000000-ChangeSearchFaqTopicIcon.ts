import { MigrationInterface, QueryRunner } from 'typeorm';

// El tema «Buscar y pedir plaza» del centro de ayuda llevaba la lupa, la
// misma del buscador de la pantalla, y se confundían (revisión del autor del
// 16/11/2026): pasa a un billete (la plaza). Solo si sigue con la lupa: si se
// cambió desde el panel, se deja
export class ChangeSearchFaqTopicIcon1800100000000 implements MigrationInterface {
  name = 'ChangeSearchFaqTopicIcon1800100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE faq_topics SET icon = 'ticket-outline'
        WHERE key = 'search' AND icon = 'search-outline'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE faq_topics SET icon = 'search-outline'
        WHERE key = 'search' AND icon = 'ticket-outline'`,
    );
  }
}
