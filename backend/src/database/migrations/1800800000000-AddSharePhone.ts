import { MigrationInterface, QueryRunner } from 'typeorm';

// El teléfono pasa a ser opcional y compartirlo, voluntario:
// - users.share_phone: si quien viaja deja que la otra persona del viaje le
//   llame con el viaje en curso. Empieza desactivado (privacidad por defecto,
//   artículo 25 del RGPD) y solo se activa con el teléfono verificado
// - pending_registrations.phone admite NULL: el registro ya no lo pide
//   (users.phone ya lo admitía)
export class AddSharePhone1800800000000 implements MigrationInterface {
  name = 'AddSharePhone1800800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN share_phone boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE pending_registrations ALTER COLUMN phone DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los registros a medias sin teléfono no caben en la versión anterior
    await queryRunner.query(
      `DELETE FROM pending_registrations WHERE phone IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE pending_registrations ALTER COLUMN phone SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE users DROP COLUMN share_phone`);
  }
}
