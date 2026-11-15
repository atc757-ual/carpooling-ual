import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Preguntas frecuentes: la app lee, sin sesión, las publicadas (las que
// carga la migración AddFaqs) con sus filtros y en su idioma. El test añade
// un borrador con la marca DRAFT_MARK y lo borra al terminar
const DRAFT_MARK = 'faqs-e2e-draft';

interface FaqBody {
  '@type': string;
  id: string;
  href: string;
  topic: string;
  audience: string;
  quickContexts: string[];
  question: string;
  answer: string;
  points: string[];
}

interface TopicBody {
  key: string;
  name: string;
  icon: string;
}

describe('FAQs (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let draftId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO faqs (
         topic_id, sort_order, audience, quick_contexts, question_es,
         question_en, answer_es, answer_en, status
       )
       SELECT id, 99, 'both', ARRAY['search'], mark, mark, mark, mark, 'draft'
       FROM faq_topics, (SELECT $1::text AS mark) AS draft
       WHERE key = 'search'
       RETURNING id`,
      [DRAFT_MARK],
    );
    draftId = rows[0].id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM faqs WHERE question_es = $1', [
      DRAFT_MARK,
    ]);
    await app.close();
  });

  async function list(query: Record<string, string>): Promise<FaqBody[]> {
    const response = await request(app.getHttpServer())
      .get('/api/faqs')
      .query({ limit: '100', ...query })
      .expect(200);
    return response.body as FaqBody[];
  }

  it('lists the published FAQs without a session, by topic order', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/faqs')
      .query({ limit: '100' })
      .expect(200);
    const faqs = response.body as FaqBody[];

    expect(response.headers['x-total-count']).toBe('17');
    expect(response.headers['x-result-count']).toBe('17');
    expect(faqs.some((faq) => faq.question === DRAFT_MARK)).toBe(false);
    expect(faqs[0]).toMatchObject({
      '@type': 'Faq',
      topic: 'search',
      audience: 'passenger',
      quickContexts: ['search'],
      question: '¿Por qué hora de llegada o de salida?',
      points: [],
    });
    expect(faqs[0].href).toBe(`/api/faqs/${faqs[0].id}`);
  });

  it('pages the list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/faqs')
      .query({ offset: '15', limit: '5' })
      .expect(200);

    expect(response.headers['x-total-count']).toBe('17');
    expect(response.body).toHaveLength(2);
  });

  it('gives the quick questions of a screen', async () => {
    const faqs = await list({ context: 'publish' });

    expect(faqs).toHaveLength(6);
    expect(faqs.every((faq) => faq.quickContexts.includes('publish'))).toBe(
      true,
    );
  });

  it('gives a mode its questions and the ones for both', async () => {
    const audiences = (await list({ audience: 'driver' })).map(
      (faq) => faq.audience,
    );

    expect(new Set(audiences)).toEqual(new Set(['driver', 'both']));
    expect(audiences).toHaveLength(11);
  });

  it('filters by topic', async () => {
    const faqs = await list({ topic: 'cancellations' });

    expect(faqs.map((faq) => faq.question)).toEqual([
      '¿Qué pasa si cancelo?',
      '¿Puedo cancelar mi plaza?',
    ]);
    expect(faqs[0].points).toHaveLength(4);
  });

  it('searches ignoring case and accents, also in the points', async () => {
    const byQuestion = await list({ q: 'CODIGO' });
    const byPoint = await list({ q: 'cancelacion tardia' });

    expect(byQuestion.map((faq) => faq.question)).toEqual([
      '¿Para qué es el código de embarque?',
    ]);
    expect(byPoint.map((faq) => faq.question)).toEqual([
      '¿Puedo cancelar mi plaza?',
    ]);
  });

  it('searches the wildcards as plain text', async () => {
    expect(await list({ q: '%_' })).toHaveLength(0);
  });

  it('answers and searches in English', async () => {
    const faqs = await list({ lang: 'en', q: 'boarding code' });

    expect(faqs).toHaveLength(1);
    expect(faqs[0].question).toBe('What is the boarding code for?');
    expect(await list({ lang: 'en', q: 'embarque' })).toHaveLength(0);
  });

  it('gets one published FAQ by its link', async () => {
    const [first] = await list({ topic: 'help' });

    const response = await request(app.getHttpServer())
      .get(first.href)
      .query({ lang: 'en' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: first.id,
      question: 'Do I have to pay anything?',
    });
  });

  it('does not show a draft or an unknown FAQ', async () => {
    for (const id of [draftId, '00000000-0000-4000-8000-000000000000']) {
      const response = await request(app.getHttpServer())
        .get(`/api/faqs/${id}`)
        .expect(404);
      expect(response.body).toMatchObject({ code: 'FAQ_NOT_FOUND' });
    }
  });

  it('rejects invalid filters', async () => {
    const queries = [
      { lang: 'fr' },
      { context: 'home' },
      { audience: 'admin' },
      { topic: 'No Vale' },
      { q: 'a' },
    ];
    for (const query of queries) {
      const response = await request(app.getHttpServer())
        .get('/api/faqs')
        .query(query)
        .expect(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    }
    await request(app.getHttpServer()).get('/api/faqs/not-a-uuid').expect(400);
  });

  it('lists the topics in order and in the language asked for', async () => {
    const spanish = await request(app.getHttpServer())
      .get('/api/faq-topics')
      .expect(200);
    const english = await request(app.getHttpServer())
      .get('/api/faq-topics')
      .query({ lang: 'en' })
      .expect(200);
    const topics = spanish.body as TopicBody[];

    expect(topics).toHaveLength(10);
    expect(topics[0]).toMatchObject({
      '@type': 'FaqTopic',
      key: 'getting-started',
      name: 'Empezar y cuenta',
      icon: 'person-circle-outline',
    });
    expect(topics[9].key).toBe('help');
    expect((english.body as TopicBody[])[0].name).toBe(
      'Getting started and account',
    );
  });
});
