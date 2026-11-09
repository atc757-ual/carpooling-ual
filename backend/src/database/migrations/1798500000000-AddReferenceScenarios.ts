import { MigrationInterface, QueryRunner } from 'typeorm';

// Escenarios S0-S5 de la evaluación (sección 11.5) como datos de referencia:
// antes solo los cargaba el seed de desarrollo, y fuera de desarrollo no se
// ejecuta, así que un despliegue limpio no tenía nada que simular (RF-15,
// RF-16). Valores provisionales hasta cerrar DP-06; el 30 % en coche propio
// es la referencia de la memoria. Si ya existen (bases con el seed antiguo),
// se dejan como están
const MODAL_SPLIT =
  '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}';
const CODES = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'];

export class AddReferenceScenarios1798500000000 implements MigrationInterface {
  name = 'AddReferenceScenarios1798500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO scenarios (code, name, user_count, adoption_rate, modal_split, time_window_min, parameters) VALUES
        ('S0', 'Base',               200,  0.000, $1, 15, '{}'),
        ('S1', 'Carpooling básico',  200,  0.300, $1, 15, '{}'),
        ('S2', 'Mayor demanda',      1000, 0.300, $1, 15, '{}'),
        ('S3', 'Horarios variables', 200,  0.300, $1, 30, '{"timeWindowRangeMin": [5, 60]}'),
        ('S4', 'Capacidad variable', 200,  0.300, $1, 15, '{"vehicleCapacities": [2, 3, 4, 6]}'),
        ('S5', 'Incidencias',        200,  0.300, $1, 15, '{"cancellationRate": 0.10}')
       ON CONFLICT (code) DO NOTHING`,
      [MODAL_SPLIT],
    );
  }

  // Solo los que no se han usado: las ejecuciones guardadas los referencian
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM scenarios s
        WHERE s.code = ANY($1)
          AND NOT EXISTS (
            SELECT 1 FROM simulation_runs r
             WHERE r.scenario_id = s.id OR r.baseline_scenario_id = s.id)`,
      [CODES],
    );
  }
}
