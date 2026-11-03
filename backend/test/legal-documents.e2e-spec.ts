import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { withLegalVersionsLock } from './support/legal-versions-lock';

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

  // Las versiones que crean los tests, con las aceptaciones que apuntan a
  // ellas (de los usuarios de prueba)
  async function removeTestVersions(): Promise<void> {
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (
         SELECT id FROM legal_documents WHERE version <> '1.0')`,
    );
    await dataSource.query(
      `DELETE FROM user_consents WHERE document_id IN (
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

  // Mientras una versión de prueba está publicada, nadie se registra (el
  // candado lo toman los registros de los demás tests: legal-versions-lock.ts).
  // Los usuarios de este test ya se registraron en beforeEach
  it('publishes a sanitized major change that users must accept', () =>
    withLegalVersionsLock(dataSource, 'exclusive', async () => {
      expect((await pending().expect(200)).body).toEqual([]);

      const draft = await admin('put', '/terms/draft')
        .send({
          content:
            '<h2 onclick="x()">1. Nuevo</h2><p>Texto<script>alert(1)</script></p><a href="javascript:x">y</a>',
          changeType: 'major',
        })
        .expect(200);
      expect(draft.body).toMatchObject({
        version: '2.0',
        status: 'draft',
        changeType: 'major',
        summary: null,
        content: '<h2>1. Nuevo</h2><p>Texto</p><a>y</a>',
      });
      // El borrador no cambia la vigente y no se publica sin «Qué ha cambiado»
      await request(app.getHttpServer())
        .get('/api/legal-documents/terms')
        .expect(200)
        .expect(({ body }) => expect((body as Document).version).toBe('1.0'));
      const noSummary = await admin('post', '/terms/draft/publish').expect(422);
      expect((noSummary.body as { code: string }).code).toBe(
        'LEGAL_SUMMARY_REQUIRED',
      );

      await admin('put', '/terms/draft')
        .send({
          content: '<h2>1. Nuevo</h2><p>Texto</p>',
          changeType: 'major',
          summary: '  Nuevas normas de convivencia.  ',
        })
        .expect(200);
      await admin('post', '/terms/draft/publish').expect(200);
      try {
        expect((await pending().expect(200)).body).toEqual([
          {
            type: 'terms',
            version: '2.0',
            href: '/api/legal-documents/terms',
          },
        ]);
        // Un cambio importante se pide aceptar al entrar: no va a Avisos
        const notices = await request(app.getHttpServer())
          .get('/api/users/me/notifications')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);
        expect(notices.body).toEqual([]);
        const outdated = await accept('1.0').expect(409);
        expect((outdated.body as { code: string }).code).toBe(
          'LEGAL_DOCUMENT_OUTDATED',
        );
        await accept('2.0').expect(204);
        await accept('2.0').expect(204);
        expect((await pending().expect(200)).body).toEqual([]);

        // La aceptación apunta a la versión exacta y guarda el hash de su texto
        const [consent] = await dataSource.query<
          { content_hash: string; version: string; hash: string }[]
        >(
          `SELECT c.document_id, c.content_hash, d.version,
                encode(sha256(convert_to(d.content, 'UTF8')), 'hex') AS hash
           FROM user_consents c JOIN legal_documents d ON d.id = c.document_id
          WHERE c.source = 'document_update' AND c.user_id = (
            SELECT id FROM users WHERE email = $1)`,
          [`${EMAIL_PREFIX}pia@ual.es`],
        );
        expect(consent).toMatchObject({
          version: '2.0',
          content_hash: consent.hash,
        });

        const current = await request(app.getHttpServer())
          .get('/api/legal-documents/terms')
          .expect(200);
        expect(current.body).toMatchObject({
          version: '2.0',
          changeType: 'major',
          summary: 'Nuevas normas de convivencia.',
        });
      } finally {
        // Antes de soltar el candado (legal-versions-lock.ts)
        await removeTestVersions();
      }
    }));

  it('asks nothing after a minor change and never edits a published version', () =>
    withLegalVersionsLock(dataSource, 'exclusive', async () => {
      const draft = await admin('put', '/privacy/draft')
        .send({ content: '<p>Aclaración</p>', summary: 'Una aclaración.' })
        .expect(200);
      expect(draft.body).toMatchObject({ version: '1.1', changeType: 'minor' });
      // Cambiar el tipo cambia el número del borrador
      await admin('put', '/privacy/draft')
        .send({
          content: '<p>Aclaración</p>',
          summary: 'x',
          changeType: 'major',
        })
        .expect(200)
        .expect(({ body }) => expect((body as Document).version).toBe('2.0'));
      await admin('put', '/privacy/draft')
        .send({ content: '<p>Aclaración</p>', summary: 'Una aclaración.' })
        .expect(200);

      const published = await admin('post', '/privacy/draft/publish').expect(
        200,
      );
      const documentId = (published.body as { id: string }).id;
      // El cambio menor avisa a todos los usuarios activos, también a los que
      // crean a la vez otros tests (en paralelo) y que cuentan sus avisos: se
      // borran al momento todos los avisos de esta versión salvo los de este test
      await dataSource.query(
        `DELETE FROM notifications
        WHERE legal_document_id = $1
          AND user_id NOT IN (SELECT id FROM users WHERE email LIKE $2)`,
        [documentId, `${EMAIL_PREFIX}%`],
      );
      try {
        expect((await pending().expect(200)).body).toEqual([]);

        // Solo se avisa, en Avisos, con el enlace al documento y sin viaje
        const notices = await request(app.getHttpServer())
          .get('/api/users/me/notifications')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);
        expect(notices.body).toEqual([
          expect.objectContaining({
            type: 'privacy_updated',
            trip: null,
            request: null,
            legalDocument: {
              id: (published.body as { id: string }).id,
              href: '/api/legal-documents/privacy',
            },
            isRead: false,
          }),
        ]);

        await expect(
          dataSource.query(
            "UPDATE legal_documents SET content = '<p>Otro</p>' WHERE id = $1",
            [(published.body as { id: string }).id],
          ),
        ).rejects.toThrow('A published legal document cannot be changed');
      } finally {
        await removeTestVersions();
      }
    }));

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
    const list = await admin('get', '', userToken).expect(403);
    expect((list.body as { code: string }).code).toBe('PROFILE_REQUIRED');
    await admin('put', '/terms/draft', userToken)
      .send({ content: '<p>Nada</p>' })
      .expect(403);
  });
});
