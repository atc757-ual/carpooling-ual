import { MigrationInterface, QueryRunner } from 'typeorm';

// En el borrador de la Política de privacidad 1.1 (pendiente de revisar con el
// director), «Quién los ve» añade que el origen y el destino de un viaje
// (suelen ser la casa del conductor) solo los ven exactos su conductor, sus
// pasajeros aceptados y la administración: quien busca viaje los ve a unos
// 500 m y sin el recorrido, salvo los parkings del campus. Solo cambia el
// borrador (una versión publicada no se puede cambiar) y solo donde encuentra
// el texto previo
const ITEM_OLD =
  '  <li>La posición del conductor durante el viaje solo la ven sus pasajeros aceptados.</li>';
const ITEM_NEW =
  '  <li>La posición del conductor durante el viaje solo la ven sus pasajeros aceptados.</li>\n  <li>\n    El origen y el destino de un viaje los ven exactos su conductor, sus pasajeros aceptados y la\n    administración; quien busca viaje los ve aproximados (a unos 500 m) y sin el recorrido, salvo\n    los parkings del campus.\n  </li>';

export class AddApproximateTripLocationToPrivacyDraft1798100000000 implements MigrationInterface {
  name = 'AddApproximateTripLocationToPrivacyDraft1798100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE legal_documents
          SET content = replace(content, $1, $2)
        WHERE type = 'privacy' AND status = 'draft'
          AND position($2 in content) = 0`,
      [ITEM_OLD, ITEM_NEW],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE legal_documents
          SET content = replace(content, $2, $1)
        WHERE type = 'privacy' AND status = 'draft'`,
      [ITEM_OLD, ITEM_NEW],
    );
  }
}
