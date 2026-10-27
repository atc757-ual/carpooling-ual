import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Parkings del campus y zona de servicio de punta a punta, con los datos que
// carga la migración. Los usuarios llevan el prefijo EMAIL_PREFIX
const EMAIL_PREFIX = 'campus-parkings-e2e-';
const PASSWORD = 'secret-password';

describe('Campus parkings API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);

    const email = `${EMAIL_PREFIX}ana@ual.es`;
    await registerUser(app, {
      name: 'Ana',
      email,
      password: PASSWORD,
      profiles: ['passenger'],
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
    await app.close();
  });

  it('lists the six parkings in order, as GeoJSON points', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/campus-parkings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const parkings = response.body as {
      id: string;
      href: string;
      location: { type: string; coordinates: number[] };
    }[];
    expect(parkings.map((parking) => parking.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
    ]);
    expect(parkings[0]).toMatchObject({
      '@type': 'CampusParking',
      href: '/api/campus-parkings/p1',
      name: 'Parking P1',
      location: { type: 'Point', coordinates: [-2.401719, 36.828856] },
    });
    expect(response.headers['x-total-count']).toBe('6');
  });

  it('gets one parking and answers 404 for an unknown one', async () => {
    await request(app.getHttpServer())
      .get('/api/campus-parkings/p3')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: 'p3' }));

    await request(app.getHttpServer())
      .get('/api/campus-parkings/p9')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'CAMPUS_PARKING_NOT_FOUND' }),
      );
  });

  it('needs a session', async () => {
    await request(app.getHttpServer()).get('/api/campus-parkings').expect(401);
  });

  it('covers 30 km around the campus: Roquetas yes, Vera no', async () => {
    const [area] = await dataSource.query<
      { radius_m: number; roquetas: boolean; vera: boolean }[]
    >(`
      SELECT radius_m,
             ST_Covers(area, ST_SetSRID(ST_MakePoint(-2.6146, 36.7642), 4326)::geography) AS roquetas,
             ST_Covers(area, ST_SetSRID(ST_MakePoint(-1.8658, 37.2434), 4326)::geography) AS vera
      FROM service_areas WHERE id = 'ual-30km'
    `);

    expect(area).toEqual({ radius_m: 30000, roquetas: true, vera: false });
  });
});
