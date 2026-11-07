import { MigrationInterface, QueryRunner } from 'typeorm';

// El nombre pasa a dos campos: first_name (el nombre de pila, el único que se
// muestra a los demás usuarios) y last_name (los apellidos, en cualquier
// formato: uno, dos o compuestos). Los datos que ya había se reparten con la
// primera palabra como nombre y el resto como apellidos (vacío si no hay más).
// Las dos tablas en una sola consulta
const TABLES = ['users', 'pending_registrations'] as const;

function splitName(table: string): string {
  return `
    ALTER TABLE ${table}
      ADD COLUMN first_name varchar(50),
      ADD COLUMN last_name varchar(100) NOT NULL DEFAULT '';
    UPDATE ${table}
       SET first_name = left(split_part(name, ' ', 1), 50),
           last_name = left(btrim(substr(name, length(split_part(name, ' ', 1)) + 1)), 100);
    ALTER TABLE ${table}
      ALTER COLUMN first_name SET NOT NULL,
      ALTER COLUMN last_name DROP DEFAULT,
      DROP COLUMN name;
  `;
}

function joinName(table: string): string {
  return `
    ALTER TABLE ${table} ADD COLUMN name varchar(100);
    UPDATE ${table}
       SET name = left(btrim(first_name || ' ' || last_name), 100);
    ALTER TABLE ${table}
      ALTER COLUMN name SET NOT NULL,
      DROP COLUMN first_name,
      DROP COLUMN last_name;
  `;
}

export class SplitUserNames1797400000000 implements MigrationInterface {
  name = 'SplitUserNames1797400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(TABLES.map(splitName).join(''));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(TABLES.map(joinName).join(''));
  }
}
