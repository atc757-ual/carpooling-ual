import { MigrationInterface, QueryRunner } from 'typeorm';

// Primera migración: crea el esquema completo a partir del modelo
// entidad-relación de la memoria (Figura B.4). Sustituye a database/schema.sql.
// up() aplica el cambio (npm run migrate) y down() lo deshace en orden inverso
// (npm run migration:revert).
export class InitialSchema1792592499018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. Extensiones: PostGIS (tipos geográficos) y citext (texto sin
    // distinguir mayúsculas, para que los emails no se repitan)
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
      CREATE EXTENSION IF NOT EXISTS citext;
    `);

    // --- 2. Enumeraciones (diagramas de estados del viaje y de la solicitud)
    await queryRunner.query(`
      CREATE TYPE vehicle_status AS ENUM ('available', 'on_trip', 'inactive');
      CREATE TYPE trip_status AS ENUM ('published', 'confirmed', 'in_progress', 'finished', 'cancelled');
      CREATE TYPE request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
      CREATE TYPE incident_category AS ENUM ('technical', 'driver', 'passenger', 'other');
      CREATE TYPE travel_mode AS ENUM ('own_car', 'public_transport', 'other');
    `);

    // --- 3. Función que mantiene updated_at en todas las entidades
    await queryRunner.query(`
      CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // --- 4. Cuenta y perfiles (un perfil por tabla, 1:1 con users)
    await queryRunner.query(`
      CREATE TABLE users (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name               varchar(100) NOT NULL,
        email              citext NOT NULL UNIQUE,
        password_hash      text NOT NULL,
        time_tolerance_min smallint NOT NULL DEFAULT 15 CHECK (time_tolerance_min BETWEEN 0 AND 120),
        created_at         timestamptz NOT NULL DEFAULT now(),
        updated_at         timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE admin_profiles (
        user_id     uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        is_active   boolean NOT NULL DEFAULT true,
        enrolled_at timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE driver_profiles (
        user_id              uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        is_active            boolean NOT NULL DEFAULT true,
        enrolled_at          timestamptz NOT NULL DEFAULT now(),
        average_rating       numeric(3, 2) CHECK (average_rating BETWEEN 1 AND 5),
        has_license_declared boolean NOT NULL DEFAULT false,
        license_declared_at  timestamptz,
        updated_at           timestamptz NOT NULL DEFAULT now(),
        -- RF-21: la declaración responsable queda fechada
        CHECK (NOT has_license_declared OR license_declared_at IS NOT NULL)
      );

      CREATE TABLE passenger_profiles (
        user_id           uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        is_active         boolean NOT NULL DEFAULT true,
        enrolled_at       timestamptz NOT NULL DEFAULT now(),
        average_rating    numeric(3, 2) CHECK (average_rating BETWEEN 1 AND 5),
        has_high_priority boolean NOT NULL DEFAULT false,
        updated_at        timestamptz NOT NULL DEFAULT now()
      );
    `);

    // --- 5. Vehículos y viajes
    await queryRunner.query(`
      CREATE TABLE vehicles (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id        uuid NOT NULL REFERENCES driver_profiles (user_id) ON DELETE CASCADE,
        plate            varchar(15) NOT NULL UNIQUE,
        capacity         smallint NOT NULL CHECK (capacity BETWEEN 1 AND 8),
        status           vehicle_status NOT NULL DEFAULT 'available',
        current_location geography(Point, 4326),
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now(),
        UNIQUE (id, driver_id)
      );

      CREATE TABLE trips (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id       uuid NOT NULL REFERENCES driver_profiles (user_id),
        vehicle_id      uuid NOT NULL,
        origin          geography(Point, 4326) NOT NULL,
        destination     geography(Point, 4326) NOT NULL,
        departure_at    timestamptz NOT NULL,
        offered_seats   smallint NOT NULL CHECK (offered_seats >= 1),
        available_seats smallint NOT NULL,
        max_detour_min  smallint NOT NULL DEFAULT 10 CHECK (max_detour_min >= 0),
        status          trip_status NOT NULL DEFAULT 'published',
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        -- RF-04: el vehículo debe pertenecer al conductor del viaje
        FOREIGN KEY (vehicle_id, driver_id) REFERENCES vehicles (id, driver_id),
        -- RF-10: las plazas disponibles nunca superan las ofertadas
        CHECK (available_seats BETWEEN 0 AND offered_seats)
      );

      -- RF-04: las plazas ofertadas no pueden superar la capacidad del vehículo
      CREATE FUNCTION check_trip_seats() RETURNS trigger AS $$
      BEGIN
        IF NEW.offered_seats > (SELECT capacity FROM vehicles WHERE id = NEW.vehicle_id) THEN
          RAISE EXCEPTION 'offered_seats (%) exceeds vehicle capacity', NEW.offered_seats;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trips_check_seats
        BEFORE INSERT OR UPDATE OF offered_seats, vehicle_id ON trips
        FOR EACH ROW EXECUTE FUNCTION check_trip_seats();

      -- Índices espaciales (GiST) para el matching y uno para filtrar por estado y hora
      CREATE INDEX trips_origin_idx ON trips USING gist (origin);
      CREATE INDEX trips_destination_idx ON trips USING gist (destination);
      CREATE INDEX trips_status_departure_idx ON trips (status, departure_at);

      CREATE TABLE routes (
        trip_id      uuid PRIMARY KEY REFERENCES trips (id) ON DELETE CASCADE,
        distance_km  numeric(7, 2) NOT NULL CHECK (distance_km >= 0),
        duration_min integer NOT NULL CHECK (duration_min >= 0),
        geometry     geography(LineString, 4326) NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX routes_geometry_idx ON routes USING gist (geometry);
    `);

    // --- 6. Solicitudes e incidencias
    await queryRunner.query(`
      CREATE TABLE requests (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        passenger_id uuid NOT NULL REFERENCES passenger_profiles (user_id),
        requested_at timestamptz NOT NULL DEFAULT now(),
        is_priority  boolean NOT NULL DEFAULT false,
        status       request_status NOT NULL DEFAULT 'pending',
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now(),
        UNIQUE (id, trip_id)
      );

      -- Un pasajero no puede tener dos solicitudes vivas para el mismo viaje
      CREATE UNIQUE INDEX requests_active_per_trip_idx
        ON requests (trip_id, passenger_id)
        WHERE status IN ('pending', 'accepted');

      CREATE TABLE incidents (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_id     uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
        request_id  uuid,
        reporter_id uuid NOT NULL REFERENCES users (id),
        category    incident_category NOT NULL,
        description text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        -- La solicitud afectada (si hay) debe ser del mismo viaje
        FOREIGN KEY (request_id, trip_id) REFERENCES requests (id, trip_id)
      );
    `);

    // --- 7. Eventos para el Gemelo Digital (RNF-08, RNF-11). Formato
    // provisional hasta cerrar DP-05. El id lo genera el productor y actúa
    // como clave de idempotencia: un evento duplicado se rechaza
    await queryRunner.query(`
      CREATE TABLE events (
        id               uuid PRIMARY KEY,
        source_entity_id uuid NOT NULL,
        type             varchar(60) NOT NULL,
        payload          jsonb NOT NULL DEFAULT '{}',
        occurred_at      timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX events_source_idx ON events (source_entity_id, occurred_at);
      CREATE INDEX events_type_idx ON events (type, occurred_at);
    `);

    // --- 8. Simulación (escenarios S0-S5). Parámetros provisionales hasta
    // cerrar DP-06
    await queryRunner.query(`
      CREATE TABLE scenarios (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code            varchar(10) NOT NULL UNIQUE,
        name            varchar(100) NOT NULL,
        user_count      integer NOT NULL CHECK (user_count > 0),
        adoption_rate   numeric(4, 3) NOT NULL CHECK (adoption_rate BETWEEN 0 AND 1),
        modal_split     jsonb NOT NULL,
        time_window_min smallint NOT NULL CHECK (time_window_min >= 0),
        replicas        smallint NOT NULL DEFAULT 30 CHECK (replicas > 0),
        -- Resto de parámetros de RF-16 (capacidad, tasa de incidencias...)
        parameters      jsonb NOT NULL DEFAULT '{}',
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE simulated_agents (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        scenario_id  uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
        origin       geography(Point, 4326) NOT NULL,
        destination  geography(Point, 4326) NOT NULL,
        desired_time time NOT NULL,
        usual_mode   travel_mode NOT NULL,
        is_driver    boolean NOT NULL DEFAULT false,
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX simulated_agents_scenario_idx ON simulated_agents (scenario_id);

      CREATE TABLE simulation_results (
        id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        scenario_id           uuid NOT NULL REFERENCES scenarios (id) ON DELETE CASCADE,
        seed                  bigint NOT NULL,
        vehicle_count         integer NOT NULL CHECK (vehicle_count >= 0),
        average_occupancy     numeric(4, 2) NOT NULL CHECK (average_occupancy >= 0),
        covered_requests_rate numeric(5, 4) NOT NULL CHECK (covered_requests_rate BETWEEN 0 AND 1),
        created_at            timestamptz NOT NULL DEFAULT now(),
        updated_at            timestamptz NOT NULL DEFAULT now(),
        -- Réplicas emparejadas: una sola ejecución por escenario y semilla
        UNIQUE (scenario_id, seed)
      );
    `);

    // --- 9. Triggers de updated_at en todas las tablas que lo tienen
    await queryRunner.query(`
      DO $$
      DECLARE
        table_name text;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY[
          'users', 'admin_profiles', 'driver_profiles', 'passenger_profiles',
          'vehicles', 'trips', 'routes', 'requests', 'incidents',
          'scenarios', 'simulated_agents', 'simulation_results'
        ] LOOP
          EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
               FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name, table_name
          );
        END LOOP;
      END;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Orden inverso a up(): primero las tablas que dependen de otras.
    // Los triggers y los índices se borran junto con sus tablas.
    await queryRunner.query(`
      DROP TABLE simulation_results;
      DROP TABLE simulated_agents;
      DROP TABLE scenarios;
      DROP TABLE events;
      DROP TABLE incidents;
      DROP TABLE requests;
      DROP TABLE routes;
      DROP TABLE trips;
      DROP TABLE vehicles;
      DROP TABLE passenger_profiles;
      DROP TABLE driver_profiles;
      DROP TABLE admin_profiles;
      DROP TABLE users;
    `);

    await queryRunner.query(`
      DROP FUNCTION check_trip_seats();
      DROP FUNCTION set_updated_at();
    `);

    await queryRunner.query(`
      DROP TYPE travel_mode;
      DROP TYPE incident_category;
      DROP TYPE request_status;
      DROP TYPE trip_status;
      DROP TYPE vehicle_status;
    `);

    // Las extensiones (postgis, citext) se dejan instaladas: la imagen de
    // PostGIS ya las trae y otras partes de la base de datos podrían usarlas
  }
}
