import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { SeatRequest } from '../src/modules/requests/entities/seat-request.entity';

// Comprueba que la entidad SeatRequest encaja con la tabla requests y la regla
// de la base de datos de una sola solicitud viva por pasajero y viaje. Trabaja
// dentro de una transacción que se deshace al final de cada test
describe('SeatRequest entity (e2e)', () => {
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

  // Un viaje de un conductor y un pasajero, creados con SQL: este test no
  // depende de los services de otros módulos
  async function insertTripAndPassenger(): Promise<{
    tripId: string;
    passengerId: string;
  }> {
    const driverId = await insertId(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Ana', 'seat-request-driver@ual.es', 'hash') RETURNING id`,
    );
    await queryRunner.query(
      'INSERT INTO driver_profiles (user_id) VALUES ($1)',
      [driverId],
    );
    const vehicleId = await insertId(
      `INSERT INTO vehicles (driver_id, plate, capacity)
       VALUES ($1, '9601BCD', 4) RETURNING id`,
      [driverId],
    );
    const tripId = await insertId(
      `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                          departure_at, offered_seats, available_seats)
       VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.4058 36.8297)',
               now() + interval '1 day', 3, 3) RETURNING id`,
      [driverId, vehicleId],
    );
    const passengerId = await insertId(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Pia', 'seat-request-passenger@ual.es', 'hash') RETURNING id`,
    );
    await queryRunner.query(
      'INSERT INTO passenger_profiles (user_id) VALUES ($1)',
      [passengerId],
    );
    return { tripId, passengerId };
  }

  function saveRequest(
    tripId: string,
    passengerId: string,
    status: SeatRequest['status'] = 'pending',
  ): Promise<SeatRequest> {
    const manager = queryRunner.manager;
    return manager.save(
      manager.create(SeatRequest, { tripId, passengerId, status }),
    );
  }

  it('saves a seat request and reads it back with its defaults', async () => {
    const { tripId, passengerId } = await insertTripAndPassenger();
    const { id } = await saveRequest(tripId, passengerId);

    const request = await queryRunner.manager.findOneByOrFail(SeatRequest, {
      id,
    });

    expect(request).toMatchObject({
      tripId,
      passengerId,
      isPriority: false,
      status: 'pending',
    });
    expect(request.requestedAt).toBeInstanceOf(Date);
  });

  it('does not allow two live requests of the same passenger for a trip', async () => {
    const { tripId, passengerId } = await insertTripAndPassenger();
    await saveRequest(tripId, passengerId);

    await expect(saveRequest(tripId, passengerId)).rejects.toThrow(
      /requests_active_per_trip_idx/,
    );
  });

  it('allows a new request once the previous one is cancelled', async () => {
    const { tripId, passengerId } = await insertTripAndPassenger();
    await saveRequest(tripId, passengerId, 'cancelled');

    await expect(saveRequest(tripId, passengerId)).resolves.toMatchObject({
      status: 'pending',
    });
  });
});
