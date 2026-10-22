import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { EventsService } from '../src/events/events.service';
import { Trip } from '../src/modules/trips/entities/trip.entity';

// Comprueba contra PostgreSQL lo que no se puede simular: los puntos GeoJSON
// de PostGIS y el registro de eventos dentro de la transacción (outbox).
// Trabaja dentro de una transacción que se deshace al final de cada test
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};

describe('Trips entities and events (e2e)', () => {
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

  // Conductor con un vehículo de 4 plazas, creado con SQL: este test no
  // depende de los services de users
  async function insertDriverWithVehicle(): Promise<{
    driverId: string;
    vehicleId: string;
  }> {
    const [{ id: driverId }] = (await queryRunner.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Ana', 'trips-entities-test@ual.es', 'hash') RETURNING id`,
    )) as [{ id: string }];
    await queryRunner.query(
      'INSERT INTO driver_profiles (user_id) VALUES ($1)',
      [driverId],
    );
    const [{ id: vehicleId }] = (await queryRunner.query(
      `INSERT INTO vehicles (driver_id, plate, capacity)
       VALUES ($1, '9301BCD', 4) RETURNING id`,
      [driverId],
    )) as [{ id: string }];
    return { driverId, vehicleId };
  }

  it('saves a trip and reads its origin and destination back as GeoJSON', async () => {
    const { driverId, vehicleId } = await insertDriverWithVehicle();
    const manager = queryRunner.manager;

    const { id } = await manager.save(
      manager.create(Trip, {
        driverId,
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: new Date('2030-01-10T07:30:00Z'),
        offeredSeats: 3,
        availableSeats: 3,
      }),
    );

    const trip = await manager.findOneByOrFail(Trip, { id });
    expect(trip).toMatchObject({
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      offeredSeats: 3,
      maxDetourMin: 10,
      status: 'published',
    });
  });

  it('rejects more offered seats than the vehicle capacity (database rule)', async () => {
    const { driverId, vehicleId } = await insertDriverWithVehicle();
    const manager = queryRunner.manager;

    await expect(
      manager.save(
        manager.create(Trip, {
          driverId,
          vehicleId,
          origin: ALMERIA_CENTRE,
          destination: UAL_CAMPUS,
          departureAt: new Date('2030-01-10T07:30:00Z'),
          offeredSeats: 5,
          availableSeats: 5,
        }),
      ),
    ).rejects.toThrow(/exceeds vehicle capacity/);
  });

  describe('events (outbox)', () => {
    const tripId = '00000000-0000-4000-8000-00000000e001';

    it('records an event with a generated id and timestamp', async () => {
      const eventsService = app.get(EventsService);

      const id = await eventsService.record(queryRunner.manager, {
        type: 'trip.published',
        sourceEntityId: tripId,
        payload: { offeredSeats: 3 },
      });

      const event = await queryRunner.manager.findOneByOrFail(DomainEvent, {
        id,
      });
      expect(event).toMatchObject({
        type: 'trip.published',
        sourceEntityId: tripId,
        payload: { offeredSeats: 3 },
      });
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('is undone together with its transaction: no change, no event', async () => {
      const eventsService = app.get(EventsService);
      const dataSource = app.get(DataSource);

      await expect(
        dataSource.transaction(async (manager) => {
          await eventsService.record(manager, {
            type: 'trip.cancelled',
            sourceEntityId: tripId,
            payload: {},
          });
          throw new Error('the change of the trip failed');
        }),
      ).rejects.toThrow('the change of the trip failed');

      await expect(
        dataSource.manager.countBy(DomainEvent, { sourceEntityId: tripId }),
      ).resolves.toBe(0);
    });
  });
});
