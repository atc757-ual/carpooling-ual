import { MigrationInterface, QueryRunner } from 'typeorm';

// Parkings del campus gestionables desde el panel (catálogos). Su id sigue
// siendo el de siempre (p1…p5, lo usan la búsqueda y la app); entity_id es un
// uuid solo para sus eventos de catálogo (events.source_entity_id es uuid)
export class AddCampusParkingEntityId1795700000000 implements MigrationInterface {
  name = 'AddCampusParkingEntityId1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE campus_parkings
        ADD COLUMN entity_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE campus_parkings DROP COLUMN entity_id',
    );
  }
}
