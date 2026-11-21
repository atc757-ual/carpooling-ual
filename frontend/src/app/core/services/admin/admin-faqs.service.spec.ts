import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminFaq, AdminFaqFields } from '../../models/admin-faq.model';
import { ApiError } from '../../models/api-error.model';
import { AdminFaqsService } from './admin-faqs.service';

const FIELDS: AdminFaqFields = {
  topic: 'ratings',
  audience: 'both',
  quickContexts: ['search'],
  questionEs: '¿Cómo valoro?',
  questionEn: '',
  answerEs: 'Al terminar el viaje.',
  answerEn: '',
  pointsEs: [],
  pointsEn: [],
};
const FAQ: AdminFaq = {
  ...FIELDS,
  id: 'faq-1',
  sortOrder: 1,
  status: 'draft',
  updatedAt: '2026-11-15T10:00:00.000Z',
};

// Deja resolver las promesas encadenadas antes de la petición siguiente
const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('AdminFaqsService', () => {
  let faqs: AdminFaqsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    faqs = TestBed.inject(AdminFaqsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the topics', async () => {
    const topics = faqs.listTopics();
    http.expectOne('/api/admin/faq-topics').flush([{ key: 'ratings', nameEs: 'Valoraciones' }]);

    await expect(topics).resolves.toEqual([{ key: 'ratings', nameEs: 'Valoraciones' }]);
  });

  it('changes and moves a topic', async () => {
    const updated = faqs.updateTopic('ratings', { nameEs: 'Reseñas', icon: 'star' });
    const patch = http.expectOne('/api/admin/faq-topics/ratings');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ nameEs: 'Reseñas', icon: 'star' });
    patch.flush({ key: 'ratings', nameEs: 'Reseñas' });
    await expect(updated).resolves.toMatchObject({ nameEs: 'Reseñas' });

    const moved = faqs.moveTopic('ratings', 'up');
    const move = http.expectOne('/api/admin/faq-topics/ratings/move');
    expect(move.request.method).toBe('POST');
    expect(move.request.body).toEqual({ direction: 'up' });
    move.flush({ key: 'ratings', sortOrder: 1 });
    await expect(moved).resolves.toMatchObject({ sortOrder: 1 });
  });

  it('lists every FAQ, asking for as many pages as there are', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({ ...FAQ, id: `faq-${index}` }));

    const all = faqs.list();
    http.expectOne('/api/admin/faqs?offset=0&limit=100').flush(fullPage);
    await flushPromises();
    http.expectOne('/api/admin/faqs?offset=100&limit=100').flush([FAQ]);

    await expect(all).resolves.toHaveLength(101);
  });

  it('creates and changes a FAQ', async () => {
    const created = faqs.create(FIELDS);
    const post = http.expectOne('/api/admin/faqs');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(FIELDS);
    post.flush(FAQ);
    await expect(created).resolves.toEqual(FAQ);

    const updated = faqs.update('faq-1', { audience: 'driver' });
    const patch = http.expectOne('/api/admin/faqs/faq-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ audience: 'driver' });
    patch.flush({ ...FAQ, audience: 'driver' });
    await expect(updated).resolves.toMatchObject({ audience: 'driver' });
  });

  it('publishes, unpublishes, moves and deletes a FAQ', async () => {
    const published = faqs.publish('faq-1');
    http.expectOne('/api/admin/faqs/faq-1/publish').flush({ ...FAQ, status: 'published' });
    await expect(published).resolves.toMatchObject({ status: 'published' });

    const unpublished = faqs.unpublish('faq-1');
    http.expectOne('/api/admin/faqs/faq-1/unpublish').flush(FAQ);
    await expect(unpublished).resolves.toMatchObject({ status: 'draft' });

    const moved = faqs.move('faq-1', 'down');
    const move = http.expectOne('/api/admin/faqs/faq-1/move');
    expect(move.request.body).toEqual({ direction: 'down' });
    move.flush({ ...FAQ, sortOrder: 2 });
    await expect(moved).resolves.toMatchObject({ sortOrder: 2 });

    const removed = faqs.remove('faq-1');
    const remove = http.expectOne('/api/admin/faqs/faq-1');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await expect(removed).resolves.toBeUndefined();
  });

  it('throws the API error', async () => {
    const published = faqs.publish('faq-1');
    http
      .expectOne('/api/admin/faqs/faq-1/publish')
      .flush(
        { '@type': 'Error', code: 'FAQ_TRANSLATION_MISSING', status: '409' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(published).rejects.toBeInstanceOf(ApiError);
    await expect(published).rejects.toMatchObject({ code: 'FAQ_TRANSLATION_MISSING' });
  });
});
