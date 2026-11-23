import { MigrationInterface, QueryRunner } from 'typeorm';

// El nombre en inglés de cada color del vehículo (name_en), como las opciones
// de las preferencias de viaje: la app enseña el del idioma activo. Los 8 de
// AddVehicleColors con su traducción; los que haya creado el panel, con el
// nombre en español hasta que lo cambie
export class AddVehicleColorNamesEn1801200000000 implements MigrationInterface {
  name = 'AddVehicleColorNamesEn1801200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vehicle_colors ADD COLUMN name_en varchar(60);

      UPDATE vehicle_colors AS color SET name_en = names.name_en
      FROM (VALUES
        ('white', 'White'),
        ('black', 'Black'),
        ('grey', 'Grey'),
        ('silver', 'Silver'),
        ('blue', 'Blue'),
        ('red', 'Red'),
        ('green', 'Green'),
        ('other', 'Other')
      ) AS names (key, name_en)
      WHERE color.key = names.key;

      UPDATE vehicle_colors SET name_en = name WHERE name_en IS NULL;

      ALTER TABLE vehicle_colors ALTER COLUMN name_en SET NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vehicle_colors DROP COLUMN name_en;`);
  }
}
