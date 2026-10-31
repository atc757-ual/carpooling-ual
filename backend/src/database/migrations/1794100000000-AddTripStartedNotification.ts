import { MigrationInterface, QueryRunner } from 'typeorm';

// Aviso trip_started: al iniciar el viaje, sus pasajeros aceptados saben que
// el conductor va de camino (la hora de recogida es un compromiso). Lleva la
// solicitud de cada pasajero, como los demás avisos que no son de incidencias
export class AddTripStartedNotification1794100000000 implements MigrationInterface {
  name = 'AddTripStartedNotification1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'trip_started'`,
    );
  }

  // Postgres no deja quitar un valor de un enum: se recrea el tipo sin él
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM notifications WHERE type = 'trip_started'`,
    );
    // La restricción compara el tipo con textos: se quita mientras cambia el
    // tipo de la columna y se vuelve a crear igual
    await queryRunner.query(`
      ALTER TABLE notifications DROP CONSTRAINT notifications_refs_check;
      ALTER TYPE notification_type RENAME TO notification_type_old;
      CREATE TYPE notification_type AS ENUM (
        'request_received', 'request_accepted', 'request_rejected',
        'request_cancelled', 'trip_cancelled', 'passenger_left',
        'incident_reported'
      );
      ALTER TABLE notifications
        ALTER COLUMN type TYPE notification_type
        USING type::text::notification_type;
      DROP TYPE notification_type_old;
      ALTER TABLE notifications ADD CONSTRAINT notifications_refs_check CHECK (
        (type = 'incident_reported' AND incident_id IS NOT NULL
           AND request_id IS NULL)
        OR (type <> 'incident_reported' AND request_id IS NOT NULL
           AND incident_id IS NULL)
      );
    `);
  }
}
