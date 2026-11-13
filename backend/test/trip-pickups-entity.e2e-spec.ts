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

  async function findTripWithAcceptedRequest(): Promise<{
    trip: Trip;
    requestId: string;
  }> {
    const rows = (await queryRunner.query(
      `SELECT r.trip_id, r.id AS request_id FROM requests r
         JOIN routes ro ON ro.trip_id = r.trip_id
        LIMIT 1`,
    )) as { trip_id: string; request_id: string }[];
    const [row] = rows;
    const trip = await queryRunner.manager.findOneByOrFail(Trip, {
      id: row.trip_id,
    });
    return { trip, requestId: row.request_id };
  }

  it('keeps the existing trips picking up on their route, up to 500 m', async () => {
    const { trip } = await findTripWithAcceptedRequest();

    expect(trip.pickupMode).toBe('on_route');
    expect(trip.maxDetourM).toBe(DEFAULT_MAX_DETOUR_M);
    const route = await queryRunner.manager.findOneByOrFail(TripRoute, {
      tripId: trip.id,
    });
    expect(route.directDurationMin).toBe(route.durationMin);
  });

  it('only allows 300, 500 or 1000 m', async () => {
    const { trip } = await findTripWithAcceptedRequest();

    await expect(
      queryRunner.query(`UPDATE trips SET max_detour_m = 700 WHERE id = $1`, [
        trip.id,
      ]),
    ).rejects.toThrow(/trips_max_detour_m_check/);
  });

  it('saves one pickup per request, in order along the trip', async () => {
    const { trip, requestId } = await findTripWithAcceptedRequest();

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
