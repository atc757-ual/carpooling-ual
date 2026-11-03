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
    return api('post', '/vehicles', token).send({
      plate,
      capacity,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
      declarationVersion: '1.0',
    });
  }

  describe('POST /api/vehicles', () => {
    it('registers a vehicle with its details and normalizes the plate', async () => {
      const ana = await tokenFor('ana');

      const response = await registerVehicle(ana, '9201 bcd').expect(201);

      const body = response.body as { id: string };
      expect(response.body).toEqual({
        '@type': 'Vehicle',
        id: body.id,
        href: `/api/vehicles/${body.id}`,
        plate: '9201BCD',
        plateCountry: 'ES',
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        capacity: 4,
        status: 'available',
        isDeclared: true,
      });
      expect(response.headers.location).toBe(`/api/vehicles/${body.id}`);
    });

    // RF-21: la declaración del vehículo (seguro e ITV) se acepta al
    // registrarlo y queda unida a él, con su versión y la huella de su texto
    it('records the declaration of the vehicle and rejects an old version', async () => {
      const ana = await tokenFor('ana');

      const outdated = await api('post', '/vehicles', ana)
        .send({
          plate: '9209BCD',
          capacity: 4,
          brand: 'Seat',
          model: 'Ibiza',
          color: 'blue',
          engine: 'hybrid',
          declarationVersion: '0.9',
        })
        .expect(409);
      expect((outdated.body as { code: string }).code).toBe(
        'LEGAL_DOCUMENT_OUTDATED',
      );
      await api('get', '/vehicles', ana)
        .expect(200)
        .expect(({ body }) => expect(body).toEqual([]));

      const created = await registerVehicle(ana, '9209BCD').expect(201);
      const { id } = created.body as { id: string };
      const consents = await api('get', '/users/me/consents', ana).expect(200);
      const { history } = consents.body as {
        history: { type: string; vehicleId: string | null; source: string }[];
      };
      expect(history).toContainEqual(
        expect.objectContaining({
          type: 'vehicle_declaration',
          vehicleId: id,
          source: 'vehicle_setup',
          documentVersion: '1.0',
        }),
      );
      const [row] = await dataSource.query<{ content_hash: string | null }[]>(
        'SELECT content_hash FROM user_consents WHERE vehicle_id = $1',
        [id],
      );
      expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
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

    it('requires a valid engine and an offered color', async () => {
      const ana = await tokenFor('ana');
      const vehicle = {
        plate: '9204BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        declarationVersion: '1.0',
      };
      const engine = await api('post', '/vehicles', ana)
        .send({ ...vehicle, color: 'blue', engine: 'diesel' })
        .expect(400);
      const { fields } = engine.body as { fields: { field: string }[] };
      expect(fields.map(({ field }) => field)).toEqual(['engine']);

      // El color sale del catálogo (vehicle_colors), no de una lista fija
      const color = await api('post', '/vehicles', ana)
        .send({ ...vehicle, color: 'purple', engine: 'hybrid' })
        .expect(400);
      expect((color.body as { code: string }).code).toBe(
        'VEHICLE_COLOR_NOT_OFFERED',
      );
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

    it('registers a plate of another European country, unique with its country', async () => {
      const ana = await tokenFor('ana');
      const bob = await tokenFor('bob');
      await registerVehicle(ana, '9205BCD').expect(201);
      const vehicle = {
        capacity: 4,
        brand: 'Peugeot',
        model: '208',
        color: 'blue',
        engine: 'other',
        declarationVersion: '1.0',
      };

      // La misma matrícula en Portugal es otro coche
      const portuguese = await api('post', '/vehicles', bob)
        .send({ ...vehicle, plate: '9205-bcd', plateCountry: 'PT' })
        .expect(201);
      expect(portuguese.body).toMatchObject({
        plate: '9205BCD',
        plateCountry: 'PT',
      });

      const french = await api('post', '/vehicles', bob)
        .send({ ...vehicle, plate: 'AB-123-CD', plateCountry: 'FR' })
        .expect(201);
      expect(french.body).toMatchObject({ plate: 'AB123CD' });

      const duplicate = await api('post', '/vehicles', ana)
        .send({ ...vehicle, plate: '9205BCD', plateCountry: 'PT' })
        .expect(409);
      expect(duplicate.body).toMatchObject({
        code: 'VEHICLE_ALREADY_REGISTERED',
      });
    });

    it('rejects a foreign plate without digits and a country outside Europe', async () => {
      const ana = await tokenFor('ana');
      const vehicle = {
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      };

      const noDigits = await api('post', '/vehicles', ana)
        .send({ ...vehicle, plate: 'ABCDEF', plateCountry: 'DE' })
        .expect(400);
      const country = await api('post', '/vehicles', ana)
        .send({ ...vehicle, plate: '9206BCD', plateCountry: 'US' })
        .expect(400);

      const fieldsOf = (body: unknown) =>
        (body as { fields: { field: string }[] }).fields.map(
          ({ field }) => field,
        );
      expect(fieldsOf(noDigits.body)).toEqual(['plate']);
      expect(fieldsOf(country.body)).toEqual(['plateCountry']);
    });

    it('makes a passenger a driver with the first vehicle', async () => {
      const passenger = await tokenFor('pia', ['passenger']);

      await registerVehicle(passenger, '9203BCD').expect(201);

      const profiles = await dataSource.query<{ is_active: boolean }[]>(
        `SELECT p.is_active FROM driver_profiles p
           JOIN users u ON u.id = p.user_id
          WHERE u.email = $1`,
        [`${EMAIL_PREFIX}pia@ual.es`],
      );
      expect(profiles).toEqual([{ is_active: true }]);
    });
  });

  describe('PATCH /api/vehicles/{id}', () => {
    it('edits the color, engine and seats without changing make or model', async () => {
      const ana = await tokenFor('ana');
      const created = await api('post', '/vehicles', ana)
        .send({
          plate: '9231BCD',
          capacity: 4,
          brand: ' Seat ',
          model: ' Ibiza ',
          color: 'blue',
          engine: 'hybrid',
          declarationVersion: '1.0',
        })
        .expect(201);
      const { id } = created.body as { id: string };
      expect(created.body).toMatchObject({ brand: 'Seat', model: 'Ibiza' });

      const response = await api('patch', `/vehicles/${id}`, ana)
        .send({ color: 'green', engine: 'electric', capacity: 3 })
        .expect(200);

      expect(response.body).toMatchObject({
        plate: '9231BCD',
        brand: 'Seat',
        model: 'Ibiza',
        color: 'green',
        engine: 'electric',
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
        .send({ brand: 'Toyota' })
        .expect(400);
      await api('patch', `/vehicles/${id}`, ana)
        .send({ engine: 'diesel' })
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
    it('answers 409 VEHICLE_LIMIT_REACHED with the 4th active vehicle', async () => {
      const ana = await tokenFor('ana');
      await registerVehicle(ana, '9221BCD').expect(201);
      await registerVehicle(ana, '9222BCD').expect(201);
      await registerVehicle(ana, '9223BCD').expect(201);

      const response = await registerVehicle(ana, '9224BCD').expect(409);

      expect(response.body).toMatchObject({ code: 'VEHICLE_LIMIT_REACHED' });
    });

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
