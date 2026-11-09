import { setTimeout as delay } from 'node:timers/promises';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { Point } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  DigitalTwinSyncService,
  POLL_INTERVAL_MS,
} from '../src/modules/digital-twin/sync/digital-twin-sync.service';
import { RequestsService } from '../src/modules/requests/requests.service';
import { OsrmClient } from '../src/modules/trips/osrm.client';
import type { RoutePlan } from '../src/modules/trips/route-plan';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// Verificación de consistencia del Gemelo Digital (RNF-11): un viaje real de
// principio a fin y, tras cada cambio, el gemelo vivo coincide con la base de
// datos (estado del viaje, del vehículo y pasajeros a bordo). OSRM se
// sustituye por uno falso. Los usuarios llevan el prefijo EMAIL_PREFIX y se
// borran con todo lo suyo
const EMAIL_PREFIX = 'twin-consistency-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};

// El vehículo en el gemelo: «idle» o «scheduled» según tenga viaje próximo,
// que en la base de datos son los dos «available»
const VEHICLE_IN_DATABASE: Record<string, string> = {
  idle: 'available',
  scheduled: 'available',
  on_trip: 'on_trip',
};

interface PlatformState {
  tripStatus: string;
  vehicleStatus: string;
  passengersOnBoard: number;
}

describe('Digital twin consistency (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let sync: DigitalTwinSyncService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OsrmClient)
      .useValue({
        route: (from: Point, to: Point): Promise<RoutePlan> =>
          Promise.resolve({
            distanceKm: 3.2,
            durationMin: 5,
            geometry: {
              type: 'LineString',
              coordinates: [from.coordinates, to.coordinates],
            },
            source: 'osrm',
          }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    sync = app.get(DigitalTwinSyncService);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function userId(name: string, profiles: string[]): Promise<string> {
    return registerUser(app, {
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      password: PASSWORD,
      profiles,
    });
  }

  async function platformState(
    tripId: string,
    vehicleId: string,
  ): Promise<PlatformState> {
    const [row] = await dataSource.query<
      { trip: string; vehicle: string; boarded: string }[]
    >(
      // A bordo solo cuentan las plazas validadas con el viaje en curso
      `SELECT t.status AS trip, v.status AS vehicle,
              CASE WHEN t.status = 'in_progress' THEN
                (SELECT coalesce(sum(r.seats), 0) FROM requests r
                  WHERE r.trip_id = t.id AND r.status = 'accepted'
                    AND r.boarded_at IS NOT NULL)
              ELSE 0 END AS boarded
         FROM trips t JOIN vehicles v ON v.id = $2
        WHERE t.id = $1`,
      [tripId, vehicleId],
    );
    return {
      tripStatus: row.trip,
      vehicleStatus: row.vehicle,
      passengersOnBoard: Number(row.boarded),
    };
  }

  function twinState(tripId: string, vehicleId: string): PlatformState | null {
    const trip = sync.twin.trips.get(tripId);
    const vehicle = sync.twin.vehicles.get(vehicleId);
    if (trip?.status == null || vehicle === undefined) {
      return null;
    }
    return {
      tripStatus: trip.status,
      vehicleStatus: VEHICLE_IN_DATABASE[vehicle.status],
      passengersOnBoard:
        trip.status === 'in_progress' ? trip.passengersOnBoard : 0,
    };
  }

  // La sincronización ya corre cada POLL_INTERVAL_MS: se espera a que el
  // gemelo alcance a la base de datos (sin llamar a syncOnce para no solaparse)
  async function expectTwinMatches(
    tripId: string,
    vehicleId: string,
  ): Promise<void> {
    const expected = await platformState(tripId, vehicleId);
    let actual = twinState(tripId, vehicleId);
    for (let tries = 0; tries < 40; tries++) {
      if (JSON.stringify(actual) === JSON.stringify(expected)) {
        break;
      }
      await delay(POLL_INTERVAL_MS);
      actual = twinState(tripId, vehicleId);
    }
    expect(actual).toEqual(expected);
  }

  it('matches the database after every step of a trip', async () => {
    const driverId = await userId('dan', ['driver']);
    await app.get(UsersService).declareDriverLicense(driverId);
    const vehicle = await app.get(VehiclesService).register(driverId, {
      plate: '9927BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const trips = app.get(TripsService);
    const requests = app.get(RequestsService);

    const { trip } = await trips.publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    await setDepartureIn(dataSource, trip.id, 10);
    await expectTwinMatches(trip.id, vehicle.id);

    const passengerId = await userId('pia', ['passenger']);
    const { request: seat } = await requests.request(passengerId, trip.id);
    await requests.accept(driverId, seat.id);
    await expectTwinMatches(trip.id, vehicle.id);
    expect((await platformState(trip.id, vehicle.id)).tripStatus).toBe(
      'confirmed',
    );

    await trips.start(driverId, trip.id);
    await expectTwinMatches(trip.id, vehicle.id);

    const [{ code }] = await dataSource.query<{ code: string }[]>(
      'SELECT board_code AS code FROM requests WHERE id = $1',
      [seat.id],
    );
    await requests.board(driverId, seat.id, code);
    await expectTwinMatches(trip.id, vehicle.id);
    expect(twinState(trip.id, vehicle.id)?.passengersOnBoard).toBe(1);

    await trips.finish(driverId, trip.id, UAL_CAMPUS);
    await expectTwinMatches(trip.id, vehicle.id);
    expect(twinState(trip.id, vehicle.id)).toEqual({
      tripStatus: 'finished',
      vehicleStatus: 'available',
      passengersOnBoard: 0,
    });
    // Cinco esperas a la sincronización (cada 250 ms)
  }, 30_000);
});
