import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Vehículos y estado del conductor (RF-21) de punta a punta. Los usuarios
// llevan el prefijo EMAIL_PREFIX; al borrarlos, sus vehículos se borran en
// cascada
const EMAIL_PREFIX = 'vehicles-e2e-';
const PASSWORD = 'secret-password';

describe('Vehicles API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  // Registra un usuario con esos perfiles y devuelve su token de acceso
  async function tokenFor(
    name: string,
    profiles: string[] = ['driver'],
  ): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  function api(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  function registerVehicle(
    token: string,
    plate: string,
    capacity = 4,
  ): request.Test {
    return api('post', '/vehicles', token).send({ plate, capacity });
  }

  describe('POST /api/vehicles', () => {
    it('registers a vehicle: 201, Location and the plate normalized', async () => {
      const ana = await tokenFor('ana');

      const response = await registerVehicle(ana, '9201 bcd').expect(201);

      const body = response.body as { id: string };
      expect(response.body).toEqual({
        '@type': 'Vehicle',
        id: body.id,
        href: `/api/vehicles/${body.id}`,
        plate: '9201BCD',
        model: null,
        capacity: 4,
        status: 'available',
      });
      expect(response.headers.location).toBe(`/api/vehicles/${body.id}`);
    });

    it('validates the plate format and the capacity (1-8)', async () => {
      const ana = await tokenFor('ana');

      const response = await registerVehicle(ana, '1234AEI', 9).expect(400);

      const { fields } = response.body as { fields: { field: string }[] };
      expect(fields.map(({ field }) => field).sort()).toEqual([
        'capacity',
        'plate',
      ]);
    });

    it('answers 409 when the plate is already registered', async () => {
      const ana = await tokenFor('ana');
      const bob = await tokenFor('bob');
      await registerVehicle(ana, '9202BCD').expect(201);

      const response = await registerVehicle(bob, '9202-BCD').expect(409);

      expect(response.body).toMatchObject({
        code: 'VEHICLE_ALREADY_REGISTERED',
      });
    });

    it('is only for drivers (403 for a passenger)', async () => {
      const passenger = await tokenFor('pia', ['passenger']);

      const response = await registerVehicle(passenger, '9203BCD').expect(403);

      expect(response.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
    });
  });

  describe('PATCH /api/vehicles/{id}', () => {
    it('saves the make and model on registration and edits it with the seats', async () => {
      const ana = await tokenFor('ana');
      const created = await api('post', '/vehicles', ana)
        .send({ plate: '9231BCD', capacity: 4, model: '  Seat Ibiza ' })
        .expect(201);
      const { id, model } = created.body as { id: string; model: string };
      expect(model).toBe('Seat Ibiza');

      const response = await api('patch', `/vehicles/${id}`, ana)
        .send({ model: 'Seat León', capacity: 3 })
        .expect(200);

      expect(response.body).toMatchObject({
        plate: '9231BCD',
        model: 'Seat León',
        capacity: 3,
      });
    });

    it('does not change the plate and validates the rest', async () => {
      const ana = await tokenFor('ana');
      const created = await registerVehicle(ana, '9232BCD').expect(201);
      const { id } = created.body as { id: string };

      await api('patch', `/vehicles/${id}`, ana)
        .send({ plate: '9999BCD' })
        .expect(400);
      await api('patch', `/vehicles/${id}`, ana)
        .send({ capacity: 9 })
        .expect(400);
      await api('patch', `/vehicles/${id}`, ana)
        .send({ model: 'X' })
        .expect(400);
    });

    it("answers 404 for another driver's vehicle", async () => {
      const ana = await tokenFor('ana');
      const bob = await tokenFor('bob');
      const created = await registerVehicle(ana, '9233BCD').expect(201);
      const { id } = created.body as { id: string };

      await api('patch', `/vehicles/${id}`, bob)
        .send({ capacity: 2 })
        .expect(404);
    });
  });

  describe('GET /api/vehicles', () => {
    it('paginates with offset/limit and the TMF count headers', async () => {
      const ana = await tokenFor('ana');
      await registerVehicle(ana, '9211BCD').expect(201);
      await registerVehicle(ana, '9212BCD').expect(201);
      await registerVehicle(ana, '9213BCD').expect(201);

      const response = await api(
        'get',
        '/vehicles?offset=1&limit=1',
        ana,
      ).expect(200);

      expect(response.headers['x-total-count']).toBe('3');
      expect(response.headers['x-result-count']).toBe('1');
      expect(response.body).toMatchObject([{ plate: '9212BCD' }]);
    });

    it('only lists the vehicles of the authenticated driver', async () => {
      const ana = await tokenFor('ana');
      const bob = await tokenFor('bob');
      await registerVehicle(bob, '9214BCD').expect(201);

      const response = await api('get', '/vehicles', ana).expect(200);

      expect(response.body).toEqual([]);
      expect(response.headers['x-total-count']).toBe('0');
    });

    it.each([
      ['a limit above 100', '?limit=500'],
      ['a negative offset', '?offset=-1'],
      ['an unknown parameter', '?sort=plate'],
    ])('rejects %s with 400', async (_case, query) => {
      const ana = await tokenFor('ana');

      const response = await api('get', `/vehicles${query}`, ana).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('GET and DELETE /api/vehicles/{id}', () => {
    it('gets one of my vehicles (the href works)', async () => {
      const ana = await tokenFor('ana');
      const created = await registerVehicle(ana, '9221BCD').expect(201);
      const { href } = created.body as { href: string };

      const response = await api('get', href.replace('/api', ''), ana).expect(
        200,
      );

      expect(response.body).toMatchObject({ plate: '9221BCD' });
    });

    it("answers 404 for another driver's vehicle", async () => {
      const ana = await tokenFor('ana');
      const bob = await tokenFor('bob');
      const created = await registerVehicle(ana, '9222BCD').expect(201);
      const { id } = created.body as { id: string };

      const response = await api('get', `/vehicles/${id}`, bob).expect(404);

      expect(response.body).toMatchObject({ code: 'VEHICLE_NOT_FOUND' });
    });

    it('deactivates with 204: the vehicle is no longer listed or found', async () => {
      const ana = await tokenFor('ana');
      const created = await registerVehicle(ana, '9223BCD').expect(201);
      const { id } = created.body as { id: string };

      const deleted = await api('delete', `/vehicles/${id}`, ana).expect(204);

      expect(deleted.body).toEqual({});
      await api('get', `/vehicles/${id}`, ana).expect(404);
      const list = await api('get', '/vehicles', ana).expect(200);
      expect(list.headers['x-total-count']).toBe('0');
    });
  });

  describe('driver status and declaration (RF-21)', () => {
    it('is ready only after the declaration and one vehicle', async () => {
      const ana = await tokenFor('ana');

      const initial = await api('get', '/users/me/driver-status', ana).expect(
        200,
      );
      expect(initial.body).toEqual({
        '@type': 'DriverStatus',
        hasLicenseDeclared: false,
        licenseDeclaredAt: null,
        activeVehicles: 0,
        isReady: false,
      });

      const declared = await api(
        'put',
        '/users/me/driver-declaration',
        ana,
      ).expect(200);
      expect(declared.body).toMatchObject({
        hasLicenseDeclared: true,
        isReady: false,
      });

      await registerVehicle(ana, '9231BCD').expect(201);
      const ready = await api('get', '/users/me/driver-status', ana).expect(
        200,
      );
      expect(ready.body).toMatchObject({ activeVehicles: 1, isReady: true });
    });

    it('is only for drivers (403 for a passenger)', async () => {
      const passenger = await tokenFor('pia', ['passenger']);

      const response = await api(
        'put',
        '/users/me/driver-declaration',
        passenger,
      ).expect(403);

      expect(response.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
    });
  });
});
