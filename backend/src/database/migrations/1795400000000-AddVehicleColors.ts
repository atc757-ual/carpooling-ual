import { MigrationInterface, QueryRunner } from 'typeorm';

// Catálogo de colores del vehículo (panel de administración, catálogos), con
// los 8 de antes y su tono en el tema claro y en el oscuro. vehicles.color
// deja el enum vehicle_color y pasa a apuntar a la clave del catálogo, así el
// panel puede añadir colores sin una migración. Nunca se borra un color: se
// desactiva
export class AddVehicleColors1795400000000 implements MigrationInterface {
  name = 'AddVehicleColors1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE vehicle_colors (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key        varchar(60) NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        name       varchar(60) NOT NULL CHECK (length(trim(name)) > 0),
        hex_light  char(7) NOT NULL CHECK (hex_light ~ '^#[0-9a-fA-F]{6}$'),
        hex_dark   char(7) NOT NULL CHECK (hex_dark ~ '^#[0-9a-fA-F]{6}$'),
        is_active  boolean NOT NULL DEFAULT true,
        sort_order smallint NOT NULL CHECK (sort_order >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO vehicle_colors (key, name, hex_light, hex_dark, sort_order) VALUES
        ('white',  'Blanco', '#ffffff', '#e8eaed', 0),
        ('black',  'Negro',  '#202124', '#3c4043', 1),
        ('grey',   'Gris',   '#808080', '#9aa0a6', 2),
        ('silver', 'Plata',  '#c0c0c0', '#bdc1c6', 3),
        ('blue',   'Azul',   '#2673c9', '#5b9be0', 4),
        ('red',    'Rojo',   '#d83b3b', '#e86a6a', 5),
        ('green',  'Verde',  '#31865b', '#4fae7f', 6),
        ('other',  'Otro',   '#8b6f9b', '#a98bbb', 7);

      ALTER TABLE vehicles
        ALTER COLUMN color TYPE varchar(60) USING color::text,
        ADD CONSTRAINT vehicles_color_fkey
          FOREIGN KEY (color) REFERENCES vehicle_colors (key);

      DROP TYPE vehicle_color;
    `);
  }

  // Solo vuelve atrás si todos los colores en uso son de los 8 de antes
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE vehicle_color AS ENUM (
        'white', 'black', 'grey', 'silver', 'blue', 'red', 'green', 'other'
      );

      ALTER TABLE vehicles
        DROP CONSTRAINT vehicles_color_fkey,
        ALTER COLUMN color TYPE vehicle_color USING color::vehicle_color;

      DROP TABLE vehicle_colors;
    `);
  }
}
