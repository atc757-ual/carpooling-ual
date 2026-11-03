import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { computeConsentFingerprint } from '../src/modules/users/user-consent';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// La declaración responsable del conductor (RF-21) como documento versionado:
// se lee como las condiciones y su aceptación queda con su versión, la huella
// de su texto y su evento. No publica versiones nuevas: los conductores de
// otros tests (en paralelo) dejarían de poder publicar. Lo que pasa tras un
// cambio importante lo prueban consents.service.spec y legal-documents.e2e
const EMAIL_PREFIX = 'driver-declaration-e2e-';
const PASSWORD = 'secret-password';

interface ConsentRow {
  document_version: string;
  source: string;
  recorded_at: Date;
  fingerprint: string;
  content_hash: string;
  hash: string;
}

describe('Driver declaration (e2e)', () => {
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

  async function driver(name: string): Promise<{ id: string; token: string }> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    const id = await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles: ['driver'],
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return { id, token: (login.body as { accessToken: string }).accessToken };
  }

  function declare(token: string, body?: object): request.Test {
    return request(app.getHttpServer())
      .put('/api/users/me/driver-declaration')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('serves the declaration as a versioned document', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/legal-documents/driver_declaration')
      .expect(200);

    expect(response.body).toMatchObject({
      type: 'driver_declaration',
      version: '1.0',
      changeType: 'major',
    });
    expect((response.body as { content: string }).content).toContain(
      'permiso de conducir en vigor',
    );
  });

  it('records the accepted version with the hash of its text and its event', async () => {
    const dan = await driver('dan');
    const before = await request(app.getHttpServer())
      .get('/api/users/me/driver-status')
      .set('Authorization', `Bearer ${dan.token}`)
      .expect(200);
    expect(before.body).toMatchObject({ hasLicenseDeclared: false });

    const outdated = await declare(dan.token, { version: '0.9' }).expect(409);
    expect((outdated.body as { code: string }).code).toBe(
      'LEGAL_DOCUMENT_OUTDATED',
    );
    const accepted = await declare(dan.token, { version: '1.0' }).expect(200);
    expect(accepted.body).toMatchObject({ hasLicenseDeclared: true });
    // Repetirla no añade otra aceptación; sin versión, se acepta la vigente
    await declare(dan.token).expect(200);

    const rows = await dataSource.query<ConsentRow[]>(
      `SELECT c.document_version, c.source, c.recorded_at, c.fingerprint,
              c.content_hash,
              encode(sha256(convert_to(d.content, 'UTF8')), 'hex') AS hash
         FROM user_consents c JOIN legal_documents d ON d.id = c.document_id
        WHERE c.user_id = $1 AND c.type = 'driver_declaration'`,
      [dan.id],
    );
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      document_version: '1.0',
      source: 'driver_setup',
      content_hash: row.hash,
      fingerprint: computeConsentFingerprint({
        userId: dan.id,
        type: 'driver_declaration',
        documentVersion: '1.0',
        action: 'granted',
        recordedAt: new Date(row.recorded_at),
      }),
    });
    const events = await dataSource.query<{ payload: { type: string } }[]>(
      `SELECT payload FROM events
        WHERE type = 'consent.granted' AND source_entity_id = $1`,
      [dan.id],
    );
    expect(events.map(({ payload }) => payload.type)).toContain(
      'driver_declaration',
    );

    const consents = await request(app.getHttpServer())
      .get('/api/users/me/consents')
      .set('Authorization', `Bearer ${dan.token}`)
      .expect(200);
    expect(consents.body).toMatchObject({
      current: {
        driverDeclaration: { documentVersion: '1.0', source: 'driver_setup' },
      },
    });
  });

  it('is not accepted through the legal acceptances of the terms', async () => {
    const dan = await driver('dan');

    await request(app.getHttpServer())
      .post('/api/users/me/legal-acceptances')
      .set('Authorization', `Bearer ${dan.token}`)
      .send({ type: 'driver_declaration', version: '1.0' })
      .expect(400);
  });
});
