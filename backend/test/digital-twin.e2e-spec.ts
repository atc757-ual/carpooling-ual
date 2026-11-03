import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EventsService } from '../src/events/events.service';
import {
  DigitalTwinSyncService,
  POLL_INTERVAL_MS,
} from '../src/modules/digital-twin/sync/digital-twin-sync.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Gemelo Digital vivo: se sincroniza con la tabla events y el panel ve su
// resumen. Los usuarios llevan el prefijo EMAIL_PREFIX; los eventos del test,
// un viaje y un vehículo inventados. Todo se borra al terminar
const EMAIL_PREFIX = 'digital-twin-e2e-';
const PASSWORD = 'secret-password';

describe('Digital twin API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const tripId = randomUUID();
  const vehicleId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM events WHERE source_entity_id = $1', [
      tripId,
    ]);
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function token(name: string, isAdmin: boolean): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    const id = await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles: ['passenger'],
    });
    if (isAdmin) {
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [id],
      );
    }
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  function getTwin(accessToken: string): request.Test {
    return request(app.getHttpServer())
      .get('/api/admin/digital-twin')
      .set('Authorization', `Bearer ${accessToken}`);
  }

  it('rejects users without the admin profile (403)', async () => {
    await getTwin(await token('pia', false)).expect(403);
  });

  it('applies a new event and shows the summary', async () => {
    const sync = app.get(DigitalTwinSyncService);
    await dataSource.transaction((manager) =>
      app.get(EventsService).record(manager, {
        type: 'trip.published',
        sourceEntityId: tripId,
        payload: {
          driverId: randomUUID(),
          vehicleId,
          status: 'published',
          offeredSeats: 3,
          availableSeats: 3,
        },
      }),
    );

    // La sincronización ya corre cada POLL_INTERVAL_MS: se espera a que
    // llegue (sin llamar a syncOnce para no solaparse con ella)
    for (let tries = 0; !sync.twin.trips.has(tripId) && tries < 40; tries++) {
      await delay(POLL_INTERVAL_MS);
    }
    expect(sync.twin.trips.get(tripId)?.status).toBe('published');
    expect(sync.twin.vehicles.get(vehicleId)?.status).toBe('scheduled');
    const response = await getTwin(await token('ada', true)).expect(200);
    const body = response.body as {
      '@type': string;
      isLive: boolean;
      lastSequence: number;
      trips: Record<string, number>;
      vehicles: Record<string, number>;
      lag: { samples: number };
    };
    expect(body).toMatchObject({ '@type': 'DigitalTwinState', isLive: true });
    expect(body.lastSequence).toBeGreaterThan(0);
    expect(body.trips.published).toBeGreaterThanOrEqual(1);
    expect(body.vehicles.scheduled).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(body.lag.samples)).toBe(true);
  });
});
