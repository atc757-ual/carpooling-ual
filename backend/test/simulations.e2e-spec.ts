import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { FakeSimulationRunner } from '../src/modules/simulation/runner/fake-simulation-runner';
import { SIMULATION_RUNNER } from '../src/modules/simulation/runner/simulation-runner';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Simulación de escenarios desde el panel (RF-15 a RF-20) de punta a punta,
// con el motor falso a una réplica cada 20 ms. Los usuarios llevan el prefijo
// EMAIL_PREFIX y se borran con sus ejecuciones y eventos
const EMAIL_PREFIX = 'simulations-e2e-';
const PASSWORD = 'secret-password';
const TICK_MS = 20;

interface RunBody {
  id: string;
  href: string;
  status: string;
  progress: number;
  scenarioConfig: { scenario: { name: string } };
  criterionMet: boolean | null;
}

describe('Simulations API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SIMULATION_RUNNER)
      .useValue(new FakeSimulationRunner(TICK_MS))
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    adminToken = await tokenFor('admin', true);
  });

  afterEach(async () => {
    await dataSource.query(
      `UPDATE simulation_runs SET status = 'cancelled'
        WHERE status IN ('queued', 'running')`,
    );
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(name: string, isAdmin = false): Promise<string> {
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

  function api(
    method: 'get' | 'post',
    path: string,
    token = adminToken,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin/simulations${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function waitForStatus(id: string, status: string): Promise<RunBody> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await api('get', `/${id}`).expect(200);
      const body = response.body as RunBody;
      if (body.status === status) {
        return body;
      }
      await new Promise((resolve) => setTimeout(resolve, TICK_MS));
    }
    throw new Error(`The run ${id} never reached ${status}`);
  }

  it('rejects users without the admin profile (403)', async () => {
    const token = await tokenFor('passenger');
    const id = '0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90';
    await api('get', '/scenarios', token).expect(403);
    await api('get', '', token).expect(403);
    await api('post', '', token).send({ scenario: 'S1', seed: 1 }).expect(403);
    await api('get', `/${id}`, token).expect(403);
    await api('get', `/${id}/results`, token).expect(403);
    await api('get', `/${id}/results.csv`, token).expect(403);
    await api('post', `/${id}/cancel`, token).expect(403);
  });

  it('lists the predefined scenarios with their configuration (RF-16)', async () => {
    const response = await api('get', '/scenarios').expect(200);
    const scenarios = response.body as { code: string; users: number }[];
    expect(scenarios.map((s) => s.code)).toEqual([
      'S0',
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
    ]);
    expect(scenarios[2].users).toBeGreaterThan(scenarios[1].users);
  });

  it('answers 404 for an unknown scenario code', async () => {
    const response = await api('post', '')
      .send({ scenario: 'S9', seed: 1 })
      .expect(404);
    expect((response.body as { code: string }).code).toBe('SCENARIO_NOT_FOUND');
  });

  it('runs a scenario to the end and serves its results and CSV', async () => {
    const created = await api('post', '')
      .send({ scenario: 'S1', replicas: 3, seed: 7 })
      .expect(201);
    const run = created.body as RunBody;
    expect(created.headers.location).toBe(run.href);
    expect(run.scenarioConfig.scenario.name).toBe('Carpooling básico');

    const finished = await waitForStatus(run.id, 'finished');
    expect(finished.progress).toBe(3);
    expect(typeof finished.criterionMet).toBe('boolean');

    const results = await api('get', `/${run.id}/results`).expect(200);
    const body = results.body as {
      replicas: number;
      summary: { vehiclesAvoidedPct: { mean: number } };
      series: unknown[];
    };
    expect(body.replicas).toBe(3);
    expect(body.series.length).toBeGreaterThan(0);

    const csv = await api('get', `/${run.id}/results.csv`).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.trimEnd().split('\n')).toHaveLength(4);

    const list = await api('get', '?limit=1').expect(200);
    expect(list.headers['x-total-count']).toEqual(expect.any(String));
    expect((list.body as RunBody[])[0].id).toBe(run.id);

    const events: { type: string; payload: { adminId: string | null } }[] =
      await dataSource.query(
        `SELECT type, payload FROM events WHERE source_entity_id = $1
        ORDER BY occurred_at`,
        [run.id],
      );
    expect(events.map((e) => e.type)).toEqual([
      'simulation.requested',
      'simulation.finished',
    ]);
    expect(events[0].payload.adminId).toEqual(expect.any(String));
  });

  it('allows one run at a time and cancels it', async () => {
    const created = await api('post', '')
      .send({ scenario: 'S2', replicas: 100, seed: 1 })
      .expect(201);
    const run = created.body as RunBody;
    const busy = await api('post', '')
      .send({ scenario: 'S1', seed: 2 })
      .expect(409);
    expect((busy.body as { code: string }).code).toBe(
      'SIMULATION_ALREADY_RUNNING',
    );

    const notFinished = await api('get', `/${run.id}/results`).expect(409);
    expect((notFinished.body as { code: string }).code).toBe(
      'SIMULATION_NOT_FINISHED',
    );

    const cancelled = await api('post', `/${run.id}/cancel`).expect(200);
    expect((cancelled.body as RunBody).status).toBe('cancelled');

    const again = await api('post', `/${run.id}/cancel`).expect(409);
    expect((again.body as { code: string }).code).toBe(
      'INVALID_SIMULATION_TRANSITION',
    );
  });

  it('marks as failed a run without news from the engine', async () => {
    const created = await api('post', '')
      .send({ scenario: 'S1', replicas: 100, seed: 3 })
      .expect(201);
    const stale = created.body as RunBody;
    // El motor deja de dar noticias (como si se hubiera reiniciado el
    // servidor) y la última fue hace 2 minutos. Sin triggers en esta
    // transacción: set_updated_at pondría la hora actual
    await waitForStatus(stale.id, 'running');
    app.get<FakeSimulationRunner>(SIMULATION_RUNNER).cancel(stale.id);
    await dataSource.transaction(async (manager) => {
      await manager.query('SET LOCAL session_replication_role = replica');
      await manager.query(
        `UPDATE simulation_runs SET updated_at = now() - interval '2 minutes'
          WHERE id = $1`,
        [stale.id],
      );
    });
    await api('post', '')
      .send({ scenario: 'S1', replicas: 1, seed: 4 })
      .expect(201);
    const failed = await api('get', `/${stale.id}`).expect(200);
    expect(failed.body).toMatchObject({
      status: 'failed',
      errorCode: 'RUNNER_LOST',
    });
  });

  it('validates the input and answers 404 for an unknown run', async () => {
    await api('post', '').send({ scenario: 'X9', seed: 1 }).expect(400);
    await api('post', '')
      .send({ scenario: 'S1', replicas: 101, seed: 1 })
      .expect(400);
    await api('post', '').send({ scenario: 'S1' }).expect(400);
    const missing = await api(
      'get',
      '/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
    ).expect(404);
    expect((missing.body as { code: string }).code).toBe(
      'SIMULATION_NOT_FOUND',
    );
  });
});
