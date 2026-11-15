import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Preguntas frecuentes en el panel: el administrador las crea como borrador,
// las cambia, las publica (completas en los dos idiomas), las ordena y borra
// los borradores; de los temas cambia nombres, icono y orden. Los usuarios
// llevan el prefijo EMAIL_PREFIX y las preguntas del test, la marca MARK;
// trabajan en el tema «ratings», que la migración deja vacío. Al terminar se
// borran con sus eventos y los temas vuelven a su estado
const EMAIL_PREFIX = 'admin-faqs-e2e-';
const PASSWORD = 'secret-password';
const MARK = 'admin-faqs-e2e';

interface FaqBody {
  id: string;
  topic: string;
  sortOrder: number;
  questionEs: string;
  questionEn: string;
  status: string;
}

interface TopicBody {
  key: string;
  nameEs: string;
  nameEn: string;
  sortOrder: number;
}

interface TopicRow {
  key: string;
  name_es: string;
  name_en: string;
  icon: string;
  sort_order: number;
}

describe('Admin FAQs (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let userToken: string;
  let topicSnapshot: TopicRow[];
  let startedAt: Date;

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
    startedAt = new Date();
    topicSnapshot = await dataSource.query(
      'SELECT key, name_es, name_en, icon, sort_order FROM faq_topics',
    );
    adminToken = await login('admin', true);
    userToken = await login('pia', false);
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM faqs WHERE question_es LIKE $1', [
      `${MARK}%`,
    ]);
    for (const row of topicSnapshot) {
      await dataSource.query(
        `UPDATE faq_topics
            SET name_es = $2, name_en = $3, icon = $4, sort_order = $5
          WHERE key = $1`,
        [row.key, row.name_es, row.name_en, row.icon, row.sort_order],
      );
    }
    await dataSource.query(
      `DELETE FROM events WHERE occurred_at >= $1 AND type::text LIKE 'faq%'`,
      [startedAt],
    );
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

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
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin${path}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  async function createFaq(name: string, extra = {}): Promise<FaqBody> {
    const response = await admin('post', '/faqs')
      .send({
        topic: 'ratings',
        audience: 'both',
        questionEs: `${MARK} ${name}`,
        answerEs: 'Respuesta',
        ...extra,
      })
      .expect(201);
    return response.body as FaqBody;
  }

  async function eventsOf(faqId: string): Promise<string[]> {
    const rows: { type: string }[] = await dataSource.query(
      'SELECT type FROM events WHERE source_entity_id = $1 ORDER BY sequence',
      [faqId],
    );
    return rows.map((row) => row.type);
  }

  const TRANSLATION = { questionEn: 'Question', answerEn: 'Answer' };

  it('is only for administrators', async () => {
    await request(app.getHttpServer()).get('/api/admin/faqs').expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/admin/faq-topics')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    expect(response.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
  });

  it('adds a FAQ as a draft that the app does not see', async () => {
    const faq = await createFaq('nueva', { quickContexts: ['search'] });

    expect(faq).toMatchObject({
      '@type': 'Faq',
      topic: 'ratings',
      sortOrder: 1,
      questionEn: '',
      status: 'draft',
    });
    await request(app.getHttpServer()).get(`/api/faqs/${faq.id}`).expect(404);
    expect(await eventsOf(faq.id)).toEqual(['faq.created']);
  });

  it('publishes a FAQ only with its English texts', async () => {
    const faq = await createFaq('publicar', { pointsEs: ['Un punto'] });

    const incomplete = await admin('post', `/faqs/${faq.id}/publish`).expect(
      409,
    );
    expect(incomplete.body).toMatchObject({ code: 'FAQ_TRANSLATION_MISSING' });
    // Con los textos pero sin el punto en inglés, tampoco
    await admin('patch', `/faqs/${faq.id}`).send(TRANSLATION).expect(200);
    await admin('post', `/faqs/${faq.id}/publish`).expect(409);

    await admin('patch', `/faqs/${faq.id}`)
      .send({ pointsEn: ['A point'] })
      .expect(200);
    const published = await admin('post', `/faqs/${faq.id}/publish`).expect(
      200,
    );

    expect(published.body).toMatchObject({ status: 'published' });
    const seen = await request(app.getHttpServer())
      .get(`/api/faqs/${faq.id}`)
      .query({ lang: 'en' })
      .expect(200);
    expect(seen.body).toMatchObject({ question: 'Question' });
    expect(await eventsOf(faq.id)).toEqual([
      'faq.created',
      'faq.updated',
      'faq.updated',
      'faq.published',
    ]);
  });

  it('keeps a published FAQ translated and does not delete it', async () => {
    const faq = await createFaq('publicada', TRANSLATION);
    await admin('post', `/faqs/${faq.id}/publish`).expect(200);

    const again = await admin('post', `/faqs/${faq.id}/publish`).expect(409);
    const emptied = await admin('patch', `/faqs/${faq.id}`)
      .send({ answerEn: '' })
      .expect(409);
    const removed = await admin('delete', `/faqs/${faq.id}`).expect(409);

    expect(again.body).toMatchObject({ code: 'INVALID_FAQ_TRANSITION' });
    expect(emptied.body).toMatchObject({ code: 'FAQ_TRANSLATION_MISSING' });
    expect(removed.body).toMatchObject({ code: 'FAQ_PUBLISHED_NOT_DELETABLE' });
  });

  it('takes a FAQ back to draft and deletes it', async () => {
    const faq = await createFaq('borrar', TRANSLATION);
    await admin('post', `/faqs/${faq.id}/publish`).expect(200);

    await admin('post', `/faqs/${faq.id}/unpublish`).expect(200);
    await admin('post', `/faqs/${faq.id}/unpublish`).expect(409);
    await admin('delete', `/faqs/${faq.id}`).expect(204);

    await admin('delete', `/faqs/${faq.id}`).expect(404);
    expect(await eventsOf(faq.id)).toEqual([
      'faq.created',
      'faq.published',
      'faq.unpublished',
      'faq.deleted',
    ]);
  });

  it('orders the FAQs within their topic', async () => {
    const first = await createFaq('uno');
    const second = await createFaq('dos');
    const third = await createFaq('tres');

    const moved = await admin('post', `/faqs/${third.id}/move`)
      .send({ direction: 'up' })
      .expect(200);
    const atTop = await admin('post', `/faqs/${first.id}/move`)
      .send({ direction: 'up' })
      .expect(200);
    const list = await admin('get', '/faqs')
      .query({ topic: 'ratings', status: 'draft' })
      .expect(200);

    expect(moved.body).toMatchObject({ sortOrder: 2 });
    expect(atTop.body).toMatchObject({ sortOrder: 1 });
    expect((list.body as FaqBody[]).map((faq) => faq.id)).toEqual([
      first.id,
      third.id,
      second.id,
    ]);
    expect(list.headers['x-total-count']).toBe('3');
  });

  it('moves a FAQ to the end of another topic', async () => {
    const faq = await createFaq('cambia de tema');

    const response = await admin('patch', `/faqs/${faq.id}`)
      .send({ topic: 'cancellations', audience: 'driver' })
      .expect(200);

    expect(response.body).toMatchObject({
      topic: 'cancellations',
      sortOrder: 3,
      audience: 'driver',
    });
  });

  it('searches in both languages and filters by status', async () => {
    await createFaq('búsqueda', { questionEn: 'Zebra crossing' });

    const byEnglish = await admin('get', '/faqs')
      .query({ q: 'zebra' })
      .expect(200);
    const bySpanish = await admin('get', '/faqs')
      .query({ q: `${MARK} busqueda` })
      .expect(200);
    const published = await admin('get', '/faqs')
      .query({ status: 'published', limit: '100' })
      .expect(200);

    expect(byEnglish.body).toHaveLength(1);
    expect(bySpanish.body).toHaveLength(1);
    expect(published.body).toHaveLength(17);
  });

  it('rejects what does not exist or is not valid', async () => {
    const unknownId = '00000000-0000-4000-8000-000000000000';

    const topic = await admin('post', '/faqs')
      .send({
        topic: 'no-such-topic',
        audience: 'both',
        questionEs: `${MARK} sin tema`,
        answerEs: 'Respuesta',
      })
      .expect(404);
    const faq = await admin('patch', `/faqs/${unknownId}`)
      .send({ audience: 'driver' })
      .expect(404);
    await admin('post', '/faqs')
      .send({ topic: 'ratings', audience: 'everyone', questionEs: '' })
      .expect(400);
    await admin('post', `/faqs/${unknownId}/move`)
      .send({ direction: 'left' })
      .expect(400);

    expect(topic.body).toMatchObject({ code: 'FAQ_TOPIC_NOT_FOUND' });
    expect(faq.body).toMatchObject({ code: 'FAQ_NOT_FOUND' });
  });

  it('changes and orders the topics, which keep their key', async () => {
    const changed = await admin('patch', '/faq-topics/ratings')
      .send({ nameEs: 'Opiniones', icon: 'star-outline' })
      .expect(200);
    await admin('post', '/faq-topics/getting-started/move')
      .send({ direction: 'down' })
      .expect(200);
    const list = await admin('get', '/faq-topics').expect(200);
    const topics = list.body as TopicBody[];

    expect(changed.body).toMatchObject({
      key: 'ratings',
      nameEs: 'Opiniones',
      nameEn: 'Ratings',
      icon: 'star-outline',
    });
    expect(topics).toHaveLength(10);
    expect(topics.slice(0, 2).map((topic) => topic.key)).toEqual([
      'search',
      'getting-started',
    ]);
    const unknown = await admin('patch', '/faq-topics/no-such-topic')
      .send({ nameEs: 'Nada' })
      .expect(404);
    expect(unknown.body).toMatchObject({ code: 'FAQ_TOPIC_NOT_FOUND' });
  });
});
