import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { GEOCODER } from '../src/modules/places/geocoder/geocoder';
import type {
  GeocodedPlace,
  Geocoder,
} from '../src/modules/places/geocoder/geocoder';
import { GeocoderUnavailableError } from '../src/modules/places/errors/geocoder-unavailable.error';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Búsqueda de direcciones de punta a punta, con un geocodificador falso (sin
// llamar a CartoCiudad) y la zona de servicio real de la base de datos. Los
// usuarios llevan el prefijo EMAIL_PREFIX; los eventos de cobertura que crean
// los tests se borran al terminar
const EMAIL_PREFIX = 'places-e2e-';
const PASSWORD = 'secret-password';

const ALMERIA: GeocodedPlace = {
  ref: 'portal|almeria|120',
  name: 'Avenida del Mediterraneo, 120',
  locality: 'Almería',
  municipality: 'Almería',
  location: { lon: -2.44615, lat: 36.83256 },
};
const VERA: GeocodedPlace = {
  ref: 'portal|vera|1',
  name: 'Calle Mayor, 1',
  locality: 'Vera',
  municipality: 'Vera',
  location: { lon: -1.86584, lat: 37.24337 },
};

const fakeGeocoder: Geocoder = {
  suggest: (text) =>
    text === 'caída'
      ? Promise.reject(new GeocoderUnavailableError())
      : Promise.resolve(
          [ALMERIA, VERA].map(({ ref, name, locality }) => ({
            ref,
            name,
            locality,
          })),
        ),
  find: (ref) =>
    Promise.resolve([ALMERIA, VERA].find((place) => place.ref === ref) ?? null),
  reverse: ({ lon }) => Promise.resolve(lon > -2 ? VERA : ALMERIA),
};

describe('Places API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let token: string;
  const startedAt = new Date();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GEOCODER)
      .useValue(fakeGeocoder)
      .compile();
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
    await dataSource.query(
      `DELETE FROM events WHERE type = 'coverage.gap_reported' AND occurred_at >= $1`,
      [startedAt],
    );
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
    await app.close();
  });

  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  async function coverageEvents(): Promise<{ payload: unknown }[]> {
    return dataSource.query(
      `SELECT payload FROM events WHERE type = 'coverage.gap_reported' AND occurred_at >= $1`,
      [startedAt],
    );
  }

  it('suggests addresses that lead to the full place, covered inside the area', async () => {
    const search = await get('/api/places?q=mediterraneo').expect(200);
    const [suggestion] = search.body as { href: string; name: string }[];
    expect(suggestion).toMatchObject({
      '@type': 'PlaceSuggestion',
      name: 'Avenida del Mediterraneo, 120',
    });
    expect(search.headers['x-result-count']).toBe('2');

    const place = await get(suggestion.href).expect(200);
    expect(place.body).toMatchObject({
      '@type': 'Place',
      href: suggestion.href,
      location: { type: 'Point', coordinates: [-2.44615, 36.83256] },
      isCovered: true,
    });
    expect(await coverageEvents()).toHaveLength(0);
  });

  it('reports a point out of the area anonymously', async () => {
    const place = await get(
      '/api/places/reverse?lon=-1.8658&lat=37.2434',
    ).expect(200);

    expect(place.body).toMatchObject({
      municipality: 'Vera',
      isCovered: false,
    });
    expect(await coverageEvents()).toEqual([
      {
        payload: {
          municipality: 'Vera',
          approximateLocation: { type: 'Point', coordinates: [-1.87, 37.24] },
        },
      },
    ]);
  });

  it('validates the text and the point, and answers 404 for an unknown place', async () => {
    await get('/api/places?q=ab').expect(400);
    await get('/api/places/reverse?lon=200&lat=36').expect(400);
    await get('/api/places/bm9uc2Vuc2U')
      .expect(404)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'PLACE_NOT_FOUND' }),
      );
  });

  it('answers 503 when the address service is down', async () => {
    await get('/api/places?q=caída')
      .expect(503)
      .expect(({ body }) =>
        expect(body).toMatchObject({ code: 'GEOCODER_UNAVAILABLE' }),
      );
  });

  it('needs a session', async () => {
    await request(app.getHttpServer()).get('/api/places?q=calle').expect(401);
  });
});
