import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Incident } from '../src/modules/incidents/entities/incident.entity';

// Comprueba que la entidad Incident encaja con la tabla (migraciones
// InitialSchema y AddIncidentReview) y la regla de la base de datos: nunca hay
// una revisión a medias. Trabaja dentro de una transacción que se deshace al
// final de cada test
describe('Incident entity (e2e)', () => {
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

  // Un viaje con su conductor, creado con SQL (sin depender de otros módulos)
  async function insertTrip(): Promise<{ tripId: string; driverId: string }> {
    const driverId = await insertId(
      `INSERT INTO users (name, email, password_hash)
       VALUES ('Dan', 'incident-entity-test@ual.es', 'hash') RETURNING id`,
    );
    await queryRunner.query(
      'INSERT INTO driver_profiles (user_id) VALUES ($1)',
      [driverId],
    );
    const vehicleId = await insertId(
      `INSERT INTO vehicles (driver_id, plate, capacity)
       VALUES ($1, '9941BCD', 4) RETURNING id`,
      [driverId],
    );
    const tripId = await insertId(
      `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                          departure_at, offered_seats, available_seats, status)
       VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.4058 36.8297)',
               now(), 3, 3, 'cancelled') RETURNING id`,
      [driverId, vehicleId],
    );
    return { tripId, driverId };
  }

  async function saveIncident(): Promise<Incident> {
    const { tripId, driverId } = await insertTrip();
    const manager = queryRunner.manager;
    return manager.save(
      manager.create(Incident, {
        tripId,
        requestId: null,
        reporterId: driverId,
        category: 'technical',
        description: 'The car broke down on the way to the campus',
      }),
    );
  }

  it('saves an incident open and without review data', async () => {
    const { id } = await saveIncident();

    const incident = await queryRunner.manager.findOneByOrFail(Incident, {
      id,
    });

    expect(incident).toMatchObject({
      status: 'open',
      reviewedBy: null,
      reviewedAt: null,
      resolution: null,
    });
  });

  it('saves a complete review', async () => {
    const incident = await saveIncident();

    await queryRunner.manager.update(Incident, incident.id, {
      status: 'reviewed',
      reviewedBy: incident.reporterId,
      reviewedAt: new Date(),
      resolution: 'The driver was contacted',
    });

    await expect(
      queryRunner.manager.findOneByOrFail(Incident, { id: incident.id }),
    ).resolves.toMatchObject({ status: 'reviewed' });
  });

  it('rejects a review without its resolution (database rule)', async () => {
    const incident = await saveIncident();

    await expect(
      queryRunner.manager.update(Incident, incident.id, {
        status: 'reviewed',
        reviewedBy: incident.reporterId,
        reviewedAt: new Date(),
      }),
    ).rejects.toThrow(/incidents_review_check/);
  });
});
