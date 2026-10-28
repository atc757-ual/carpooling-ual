import { MigrationInterface, QueryRunner } from 'typeorm';

// Desde que no se elige modo tras el registro, toda cuenta nace como pasajero
// (y es conductor al registrar su primer vehículo). Las cuentas que se
// quedaron sin perfil de pasajero ni de conductor (registradas sin llegar a
// elegir modo) pasan a ser pasajeras. Los administradores sin otro perfil no
// cambian
export class AddMissingPassengerProfiles1793800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO passenger_profiles (user_id)
       SELECT u.id FROM users u
        WHERE NOT EXISTS (SELECT 1 FROM passenger_profiles p WHERE p.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM driver_profiles d WHERE d.user_id = u.id)
          AND NOT EXISTS (SELECT 1 FROM admin_profiles a WHERE a.user_id = u.id)`,
    );
  }

  // No se puede saber qué perfiles añadió: se dejan
  public async down(): Promise<void> {
    // Sin cambios
  }
}
