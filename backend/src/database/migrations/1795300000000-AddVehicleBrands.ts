import { MigrationInterface, QueryRunner } from 'typeorm';

// Marcas habituales en España (antes en el frontend, vehicle-brands.ts), en
// orden alfabético. A partir de aquí las gestiona el panel de administración
const BRANDS = [
  'Abarth',
  'Aiways',
  'Alfa Romeo',
  'Alpine',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'BYD',
  'Cadillac',
  'Changan',
  'Chevrolet',
  'Citroën',
  'Cupra',
  'Dacia',
  'Daewoo',
  'DFSK',
  'Dodge',
  'Dongfeng',
  'DR',
  'DS',
  'Ebro',
  'Ferrari',
  'Fiat',
  'Ford',
  'Genesis',
  'Honda',
  'Hyundai',
  'Ineos',
  'Infiniti',
  'Isuzu',
  'Jaguar',
  'Jeep',
  'KGM',
  'Kia',
  'Lamborghini',
  'Lancia',
  'Land Rover',
  'Leapmotor',
  'Lexus',
  'Ligier',
  'Lynk & Co',
  'Maserati',
  'Mazda',
  'Mercedes-Benz',
  'MG',
  'MINI',
  'Mitsubishi',
  'Nissan',
  'Omoda',
  'Opel',
  'Peugeot',
  'Polestar',
  'Porsche',
  'Renault',
  'Rolls-Royce',
  'SEAT',
  'Seres',
  'Škoda',
  'Smart',
  'SsangYong',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo',
  'XPeng',
  'Zeekr',
];

// La clave de cada marca: su nombre sin tildes, en minúsculas y con guiones
// («Lynk & Co» → «lynk-co»). Copia congelada de la del módulo catalogs
function toKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Catálogo de marcas de coche (panel de administración, catálogos): sugerencias
// del formulario del vehículo. La marca de cada vehículo sigue siendo texto
// libre («Otra»), así que vehicles no cambia. Nunca se borra una marca: se
// desactiva
export class AddVehicleBrands1795300000000 implements MigrationInterface {
  name = 'AddVehicleBrands1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE vehicle_brands (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key        varchar(60) NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        name       varchar(60) NOT NULL CHECK (length(trim(name)) > 0),
        is_active  boolean NOT NULL DEFAULT true,
        sort_order smallint NOT NULL CHECK (sort_order >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    const values = BRANDS.map(
      (_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
    ).join(', ');
    await queryRunner.query(
      `INSERT INTO vehicle_brands (key, name, sort_order) VALUES ${values}`,
      BRANDS.flatMap((name, index) => [toKey(name), name, index]),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE vehicle_brands');
  }
}
