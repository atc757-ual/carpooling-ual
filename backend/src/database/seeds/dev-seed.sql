-- =============================================================================
-- Carpooling UAL - Datos de desarrollo
-- -----------------------------------------------------------------------------
-- Datos ficticios para probar el esquema en local. No usar en producción.
-- Todos los usuarios tienen la contraseña "carpooling" (hash bcrypt, compatible
-- con la librería bcrypt de Node.js).
-- Coordenadas en orden (longitud, latitud), SRID 4326.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Usuarios y perfiles
-- -----------------------------------------------------------------------------
-- Todos con la misma contraseña (carpooling, hash bcrypt) y con el correo ya
-- verificado (pueden iniciar sesión sin código): se escriben una sola vez
INSERT INTO users (id, name, email, password_hash, time_tolerance_min, email_verified_at)
SELECT seed.id::uuid, seed.name, seed.email,
       crypt('carpooling', gen_salt('bf', 10)), seed.tolerance, now()
  FROM (VALUES
    ('00000000-0000-4000-8000-000000000001', 'Admin UAL',        'admin@ual.es', 15),
    ('00000000-0000-4000-8000-000000000002', 'Lucía Conductora', 'lucia@ual.es', 10),
    ('00000000-0000-4000-8000-000000000003', 'Mario Pasajero',   'mario@ual.es', 20),
    ('00000000-0000-4000-8000-000000000004', 'Sara Mixta',       'sara@ual.es',  15)
  ) AS seed (id, name, email, tolerance);

INSERT INTO admin_profiles (user_id) VALUES
  ('00000000-0000-4000-8000-000000000001');

-- Sara tiene los dos perfiles: conduce algunos días y otros va de pasajera
INSERT INTO driver_profiles (user_id, average_rating, has_license_declared, license_declared_at) VALUES
  ('00000000-0000-4000-8000-000000000002', 4.80, true, now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000004', NULL, true, now() - interval '2 days');

INSERT INTO passenger_profiles (user_id, average_rating, has_high_priority) VALUES
  ('00000000-0000-4000-8000-000000000003', 4.50, false),
  ('00000000-0000-4000-8000-000000000004', NULL, true);

-- -----------------------------------------------------------------------------
-- Vehículos
-- -----------------------------------------------------------------------------
INSERT INTO vehicles (id, driver_id, plate, brand, model, color, engine, capacity) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000002', '1234BCD', 'Seat', 'Ibiza', 'blue', 'hybrid', 4),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000004', '5678DFG', 'Renault', 'Clio', 'grey', 'other', 3);

-- -----------------------------------------------------------------------------
-- Viajes hacia el campus de la UAL (La Cañada, Almería)
-- -----------------------------------------------------------------------------
INSERT INTO trips (id, driver_id, vehicle_id, origin, destination, origin_name, destination_name, departure_at, offered_seats, available_seats, max_detour_min, status) VALUES
  -- Roquetas de Mar -> UAL, mañana a las 08:00 (hora peninsular)
  ('00000000-0000-4000-8000-000000000201',
   '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101',
   ST_SetSRID(ST_MakePoint(-2.6147, 36.7642), 4326)::geography,
   ST_SetSRID(ST_MakePoint(-2.4048, 36.8295), 4326)::geography,
   'Roquetas de Mar', 'Campus UAL · Parking P1 (Sur)',
   (current_date + 1 + time '08:00') AT TIME ZONE 'Europe/Madrid',
   3, 2, 10, 'confirmed'),
  -- Almería centro -> UAL, mañana a las 09:30
  ('00000000-0000-4000-8000-000000000202',
   '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000102',
   ST_SetSRID(ST_MakePoint(-2.4597, 36.8381), 4326)::geography,
   ST_SetSRID(ST_MakePoint(-2.4048, 36.8295), 4326)::geography,
   'Almería centro', 'Campus UAL · Parking P1 (Sur)',
   (current_date + 1 + time '09:30') AT TIME ZONE 'Europe/Madrid',
   3, 3, 5, 'published');

-- Rutas de los viajes. En la app las calcula OSRM al publicar; aquí se
-- estiman como el plan B del backend (route-plan.ts): línea recta entre el
-- origen y el destino por un factor de rodeo de 1,3, a 50 km/h
INSERT INTO routes (trip_id, distance_km, duration_min, geometry, source)
SELECT id,
       round((ST_Distance(origin, destination) / 1000 * 1.3)::numeric, 2),
       greatest(1, round(ST_Distance(origin, destination) / 1000 * 1.3 / 50 * 60)),
       ST_MakeLine(origin::geometry, destination::geometry)::geography,
       'estimated'
FROM trips;

-- -----------------------------------------------------------------------------
-- Solicitudes
-- -----------------------------------------------------------------------------
INSERT INTO requests (id, trip_id, passenger_id, is_priority, status) VALUES
  -- Mario ya tiene plaza en el viaje de Lucía (por eso quedan 2 de 3)
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201',
   '00000000-0000-4000-8000-000000000003', false, 'accepted'),
  -- Mario también ha pedido plaza en el de Sara, pendiente de respuesta
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000202',
   '00000000-0000-4000-8000-000000000003', false, 'pending');

-- -----------------------------------------------------------------------------
-- Eventos (formato provisional, DP-05)
-- -----------------------------------------------------------------------------
INSERT INTO events (id, source_entity_id, type, payload) VALUES
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000201', 'trip.published',   '{"offeredSeats": 3}'),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000301', 'request.created',  '{"tripId": "00000000-0000-4000-8000-000000000201"}'),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000301', 'request.accepted', '{"availableSeats": 2}'),
  (gen_random_uuid(), '00000000-0000-4000-8000-000000000201', 'trip.confirmed',   '{}');

-- -----------------------------------------------------------------------------
-- Escenarios S0-S5 (sección 11.5). Valores provisionales hasta cerrar DP-06;
-- el 30 % en coche propio es la referencia de la memoria.
-- -----------------------------------------------------------------------------
INSERT INTO scenarios (code, name, user_count, adoption_rate, modal_split, time_window_min, parameters) VALUES
  ('S0', 'Base',                200,  0.000, '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}', 15, '{}'),
  ('S1', 'Carpooling básico',   200,  0.300, '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}', 15, '{}'),
  ('S2', 'Mayor demanda',       1000, 0.300, '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}', 15, '{}'),
  ('S3', 'Horarios variables',  200,  0.300, '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}', 30, '{"timeWindowRangeMin": [5, 60]}'),
  ('S4', 'Capacidad variable',  200,  0.300, '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}', 15, '{"vehicleCapacities": [2, 3, 4, 6]}'),
  ('S5', 'Incidencias',         200,  0.300, '{"own_car": 0.30, "public_transport": 0.50, "other": 0.20}', 15, '{"cancellationRate": 0.10}');
