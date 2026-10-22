import { MigrationInterface, QueryRunner } from 'typeorm';

// Avisos dentro de la aplicación (RF-19, CU-11). No se guarda texto: solo el
// tipo y a qué se refiere (viaje, solicitud o incidencia); la frase la compone
// el frontend. Así no se duplican datos personales y se puede traducir.
// La regla CHECK ata las referencias al tipo: el aviso de una incidencia
// apunta a la incidencia; los demás, a la solicitud. Al borrar el usuario, el
// viaje, la solicitud o la incidencia, sus avisos se borran en cascada
export class AddNotifications1792711241015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE notification_type AS ENUM (
        'request_received', 'request_accepted', 'request_rejected',
        'request_cancelled', 'trip_cancelled', 'passenger_left',
        'incident_reported'
      );

      CREATE TABLE notifications (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        type        notification_type NOT NULL,
        trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        request_id  uuid REFERENCES requests (id) ON DELETE CASCADE,
        incident_id uuid REFERENCES incidents (id) ON DELETE CASCADE,
        read_at     timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT notifications_refs_check CHECK (
          (type = 'incident_reported' AND incident_id IS NOT NULL
             AND request_id IS NULL)
          OR (type <> 'incident_reported' AND request_id IS NOT NULL
             AND incident_id IS NULL)
        )
      );

      -- Los avisos de un usuario, los más recientes primero, y los no leídos
      -- (el contador del frontend)
      CREATE INDEX notifications_user_idx
        ON notifications (user_id, created_at DESC);
      CREATE INDEX notifications_unread_idx
        ON notifications (user_id) WHERE read_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los índices se borran junto con la tabla
    await queryRunner.query(`
      DROP TABLE notifications;
      DROP TYPE notification_type;
    `);
  }
}
