import { MigrationInterface, QueryRunner } from 'typeorm';

// La zona del campus en el nombre de cada parking, para reconocerlo en las
// listas: P1 y P2 al sur, P3 al este, P4 y P5 al norte y P6 al oeste
const ZONES: readonly [id: string, zone: string][] = [
  ['p1', 'Sur'],
  ['p2', 'Sur'],
  ['p3', 'Este'],
  ['p4', 'Norte'],
  ['p5', 'Norte'],
  ['p6', 'Oeste'],
];

export class AddCampusParkingZones1793300000000 implements MigrationInterface {
  // «Parking P1 (Sur)»: una sola consulta para todos
  public async up(queryRunner: QueryRunner): Promise<void> {
    const values = ZONES.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(
      ', ',
    );
    await queryRunner.query(
      `UPDATE campus_parkings AS p
       SET name = 'Parking ' || upper(p.id) || ' (' || z.zone || ')'
       FROM (VALUES ${values}) AS z(id, zone)
       WHERE p.id = z.id`,
      ZONES.flat(),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE campus_parkings SET name = 'Parking ' || upper(id)`,
    );
  }
}
