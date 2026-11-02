import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Documentos legales con versiones: la vigente sin sesión, el borrador y su
// publicación desde el panel, y la aceptación de la versión nueva. Los
// usuarios llevan el prefijo EMAIL_PREFIX. Las versiones que crea el test (y
// sus eventos) se borran al terminar: solo queda la 1.0 de la migración
const EMAIL_PREFIX = 'legal-documents-e2e-';
const PASSWORD = 'secret-password';

interface Document {
  type: string;
  version: string;
  content: string;
  status?: string;
}

describe('Legal documents (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    adminToken = await login('admin', true);
    userToken = await login('pia', false);
  });

  afterEach(async () => {
    await removeTestVersions();
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function removeTestVersions(): Promise<void> {
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (
         SELECT id FROM legal_documents WHERE version <> '1.0')`,
    );
    await dataSource.query(
      "DELETE FROM legal_documents WHERE version <> '1.0'",
    );
  }

  async function login(name: string, isAdmin: boolean): Promise<string> {
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

  function admin(
    method: 'get' | 'put' | 'post',
    path: string,
    token = adminToken,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin/legal-documents${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  function pending(): request.Test {
    return request(app.getHttpServer())
      .get('/api/users/me/legal-documents/pending')
      .set('Authorization', `Bearer ${userToken}`);
  }

  function accept(version: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/users/me/legal-acceptances')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ type: 'terms', version });
  }

  it('serves the current version without a session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/legal-documents/privacy')
      .expect(200);

    expect(response.body).toMatchObject({
      '@type': 'LegalDocument',
      type: 'privacy',
      version: '1.0',
    });
    expect((response.body as Document).content).toContain('<h2>');
    await request(app.getHttpServer())
      .get('/api/legal-documents/cookies')
      .expect(400);
  });

  it('publishes a sanitized draft that users must accept', async () => {
    expect((await pending().expect(200)).body).toEqual([]);

    const draft = await admin('put', '/terms/draft')
      .send({
        content:
          '<h2 onclick="x()">1. Nuevo</h2><p>Texto<script>alert(1)</script></p><a href="javascript:x">y</a>',
      })
      .expect(200);
    expect(draft.body).toMatchObject({
      version: '1.1',
      status: 'draft',
      content: '<h2>1. Nuevo</h2><p>Texto</p><a>y</a>',
    });
    // El borrador no cambia la vigente
    await request(app.getHttpServer())
      .get('/api/legal-documents/terms')
      .expect(200)
      .expect(({ body }) => expect((body as Document).version).toBe('1.0'));

    await admin('post', '/terms/draft/publish').expect(200);
    try {
      expect((await pending().expect(200)).body).toEqual([
        {
          type: 'terms',
          version: '1.1',
          href: '/api/legal-documents/terms',
        },
      ]);
      const outdated = await accept('1.0').expect(409);
      expect((outdated.body as { code: string }).code).toBe(
        'LEGAL_DOCUMENT_OUTDATED',
      );
      await accept('1.1').expect(204);
      await accept('1.1').expect(204);
      expect((await pending().expect(200)).body).toEqual([]);
    } finally {
      // Lo antes posible: otros tests registran usuarios a la vez
      await removeTestVersions();
    }
  });

  it('lists every version and fails without a draft to publish', async () => {
    const list = await admin('get', '?type=privacy').expect(200);
    expect((list.body as Document[]).map(({ version }) => version)).toContain(
      '1.0',
    );
    const missing = await admin('post', '/privacy/draft/publish').expect(404);
    expect((missing.body as { code: string }).code).toBe(
      'LEGAL_DRAFT_NOT_FOUND',
    );
    await admin('get', '/privacy/draft').expect(404);
  });

  it('lets only admins manage the documents', async () => {
    await admin('get', '', userToken).expect(403);
    await admin('put', '/terms/draft', userToken)
      .send({ content: '<p>Nada</p>' })
      .expect(403);
  });
});
