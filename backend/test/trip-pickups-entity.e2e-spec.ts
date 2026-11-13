import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Trip } from '../src/modules/trips/entities/trip.entity';
import { TripPickup } from '../src/modules/trips/entities/trip-pickup.entity';
import { TripRoute } from '../src/modules/trips/entities/trip-route.entity';
import { DEFAULT_MAX_DETOUR_M } from '../src/modules/trips/trip-timing';

// Comprueba la migración AddPickupModes: el modo de recogida y los metros de
// los viajes, la duración directa de su ruta y la tabla de recogidas. Trabaja
// dentro de una transacción que se deshace al final de cada test
describe('Pickup modes data model (e2e)', () => {
  let app: INestApplication;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    queryRunner = app.get(DataSource).createQueryRunner();
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  afterAll(async () => {
    await app.close();
  });

  async function insertId(
    sql: string,
    params: unknown[] = [],
  ): Promise<string> {
    const [{ id }] = (await queryRunner.query(sql, params)) as [{ id: string }];
    return id;
  }

  // Un viaje con su ruta y una solicitud aceptada, creados con SQL (sin
  // indicar el modo ni los metros, para comprobar los valores por defecto):
  // este test no depende del seed ni de los services de otros módulos
  async function insertTripWithAcceptedRequest(): Promise<{
    trip: Trip;
    requestId: string;
  }> {
    const driverId = await insertId(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES ('Ana', 'Prueba', 'trip-pickups-driver@ual.es', 'hash') RETURNING id`,
    );
    await queryRunner.query(
      'INSERT INTO driver_profiles (user_id) VALUES ($1)',
      [driverId],
    );
    const vehicleId = await insertId(
      `INSERT INTO vehicles (driver_id, plate, capacity)
       VALUES ($1, '9602BCD', 4) RETURNING id`,
      [driverId],
    );
    const tripId = await insertId(
      `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                          departure_at, offered_seats, available_seats)
       VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.4058 36.8297)',
               now() + interval '1 day', 3, 2) RETURNING id`,
      [driverId, vehicleId],
    );
    await queryRunner.query(
      `INSERT INTO routes (trip_id, distance_km, duration_min, direct_duration_min, geometry, source)
       VALUES ($1, 8.5, 15, 15,
               ST_GeogFromText('LINESTRING(-2.4637 36.8381, -2.4058 36.8297)'), 'estimated')`,
      [tripId],
    );
    const passengerId = await insertId(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES ('Pia', 'Prueba', 'trip-pickups-passenger@ual.es', 'hash') RETURNING id`,
    );
    await queryRunner.query(
      'INSERT INTO passenger_profiles (user_id) VALUES ($1)',
      [passengerId],
    );
    const requestId = await insertId(
      `INSERT INTO requests (trip_id, passenger_id, seats, is_priority, status)
       VALUES ($1, $2, 1, false, 'accepted') RETURNING id`,
      [tripId, passengerId],
    );
    const trip = await queryRunner.manager.findOneByOrFail(Trip, {
      id: tripId,
    });
    return { trip, requestId };
  }

  it('picks up on the route, up to 500 m, by default', async () => {
    const { trip } = await insertTripWithAcceptedRequest();

    expect(trip.pickupMode).toBe('on_route');
    expect(trip.maxDetourM).toBe(DEFAULT_MAX_DETOUR_M);
    const route = await queryRunner.manager.findOneByOrFail(TripRoute, {
      tripId: trip.id,
    });
    expect(route.directDurationMin).toBe(15);
  });

  it('only allows 300, 500 or 1000 m', async () => {
    const { trip } = await insertTripWithAcceptedRequest();

    await expect(
      queryRunner.query(`UPDATE trips SET max_detour_m = 700 WHERE id = $1`, [
        trip.id,
      ]),
    ).rejects.toThrow(/trips_max_detour_m_check/);
  });

  it('saves one pickup per request, in order along the trip', async () => {
    const { trip, requestId } = await insertTripWithAcceptedRequest();

    const saved = await queryRunner.manager.save(
      queryRunner.manager.create(TripPickup, {
        tripId: trip.id,
        requestId,
        location: { type: 'Point', coordinates: [-2.45, 36.84] },
        position: 0,
        etaOffsetMin: 4,
      }),
    );

    expect(saved.id).toBeDefined();
    await expect(
      queryRunner.manager.insert(TripPickup, {
        tripId: trip.id,
        requestId,
        location: { type: 'Point', coordinates: [-2.44, 36.84] },
        position: 1,
        etaOffsetMin: 6,
      }),
    ).rejects.toThrow(/trip_pickups_request_id_key/);
  });
});
