-- Datos de la prueba de carga (RNF-01, RNF-07). Se cargan DESPUÉS del seed
-- (npm run seed), en una base de datos propia para la prueba, nunca en la de
-- desarrollo ni en producción:
--   psql "$DATABASE_URL" -f scripts/load/load-data.sql
-- Crea, con una semilla fija para que la prueba sea repetible:
--   - 120 conductores (también pasajeros), cada uno con un vehículo y un viaje
--     publicado mañana entre las 07:30 y las 09:30 hacia el campus, desde un
--     punto al azar de la zona de Almería (unos 30 km alrededor)
--   - 50 pasajeros, uno por usuario virtual de k6
-- Todos con la contraseña del seed («carpooling»), el correo verificado y las
-- condiciones aceptadas. Correos load-driver-NNN@ual.es y
-- load-passenger-NN@ual.es

SELECT setseed(0.42);

CREATE TEMP TABLE load_users AS
SELECT gen_random_uuid() AS id,
       'load-driver-' || lpad(n::text, 3, '0') || '@ual.es' AS email,
       'Conductor' AS first_name,
       'Carga ' || n AS last_name,
       true AS is_driver,
       n
  FROM generate_series(1, 120) AS n
UNION ALL
SELECT gen_random_uuid(),
       'load-passenger-' || lpad(n::text, 2, '0') || '@ual.es',
       'Pasajero',
       'Carga ' || n,
       false,
       n
  FROM generate_series(1, 50) AS n;

INSERT INTO users (id, first_name, last_name, email, password_hash, email_verified_at, terms_accepted_at)
SELECT l.id, l.first_name, l.last_name, l.email,
       (SELECT password_hash FROM users WHERE email = 'lucia@ual.es'),
       now(), now()
  FROM load_users l;

INSERT INTO user_consents (user_id, type, document_version, action, source, recorded_at, fingerprint)
SELECT u.id, c.type, '1.0', 'granted', 'registration', u.terms_accepted_at,
       encode(sha256(convert_to(u.id::text || '|' || c.type::text || '|1.0|granted|load', 'UTF8')), 'hex')
  FROM users u
  JOIN load_users l ON l.id = u.id
 CROSS JOIN (VALUES ('terms'::consent_type), ('privacy'::consent_type)) AS c(type);

INSERT INTO passenger_profiles (user_id, has_high_priority)
SELECT id, false FROM load_users;

INSERT INTO driver_profiles (user_id, has_license_declared, license_declared_at)
SELECT id, true, now() FROM load_users WHERE is_driver;

INSERT INTO vehicles (id, driver_id, plate, brand, model, color, engine, capacity)
SELECT gen_random_uuid(), id, lpad(n::text, 4, '0') || 'LDT', 'Seat', 'Ibiza', 'grey', 'other', 4
  FROM load_users WHERE is_driver;

INSERT INTO trips (id, driver_id, vehicle_id, origin, destination, origin_name, destination_name, departure_at, offered_seats, available_seats, max_detour_min, status)
SELECT gen_random_uuid(), v.driver_id, v.id,
       ST_SetSRID(ST_MakePoint(-2.75 + random() * 0.6, 36.70 + random() * 0.30), 4326)::geography,
       ST_SetSRID(ST_MakePoint(-2.4048, 36.8295), 4326)::geography,
       'Origen de carga', 'Campus UAL · Parking P1 (Sur)',
       (current_date + 1 + time '07:30' + make_interval(mins => floor(random() * 120)::int))
         AT TIME ZONE 'Europe/Madrid',
       3, 3, 10, 'published'
  FROM vehicles v
  JOIN load_users l ON l.id = v.driver_id;

INSERT INTO routes (trip_id, distance_km, duration_min, geometry, source)
SELECT t.id,
       round((ST_Distance(t.origin, t.destination) / 1000 * 1.3)::numeric, 2),
       greatest(1, round(ST_Distance(t.origin, t.destination) / 1000 * 1.3 / 50 * 60)),
       ST_MakeLine(t.origin::geometry, t.destination::geometry)::geography,
       'estimated'
  FROM trips t
  JOIN load_users l ON l.id = t.driver_id;
