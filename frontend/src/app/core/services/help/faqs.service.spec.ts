import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { HelpFaq } from '../../models/faq.model';
import { FaqsService } from './faqs.service';

const FAQ: HelpFaq = {
  id: 'faq-1',
  topic: 'search',
  audience: 'passenger',
  quickContexts: ['search'],
  question: '¿Qué es el margen horario?',
  answer: 'Cuánto antes o después te viene bien.',
  points: [],
};

// Deja resolver las promesas encadenadas antes de la petición siguiente
const flushPromises = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('FaqsService', () => {
  let faqs: FaqsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    faqs = TestBed.inject(FaqsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the topics in the language asked for', async () => {
    const topics = faqs.listTopics('en');
    http
      .expectOne('/api/faq-topics?lang=en')
      .flush([{ id: 't1', key: 'search', name: 'Search', icon: 'ticket-outline' }]);

    await expect(topics).resolves.toHaveLength(1);
  });

  it('asks for the audience, the screen and the text only when there are', async () => {
    const all = faqs.list({ lang: 'es' });
    http.expectOne('/api/faqs?lang=es&offset=0&limit=100').flush([FAQ]);
    await expect(all).resolves.toEqual([FAQ]);

    const filtered = faqs.list({
      lang: 'es',
      audience: 'driver',
      context: 'publish',
      q: ' plaza ',
    });
    http
      .expectOne('/api/faqs?lang=es&audience=driver&context=publish&q=plaza&offset=0&limit=100')
      .flush([]);
    await expect(filtered).resolves.toEqual([]);
  });

  it('does not search with fewer than two letters', async () => {
    const short = faqs.list({ lang: 'es', q: 'p' });
    http.expectOne('/api/faqs?lang=es&offset=0&limit=100').flush([]);

    await expect(short).resolves.toEqual([]);
  });

  it('asks for as many pages as there are', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({ ...FAQ, id: `faq-${index}` }));

    const all = faqs.list({ lang: 'es' });
    http.expectOne('/api/faqs?lang=es&offset=0&limit=100').flush(fullPage);
    await flushPromises();
    http.expectOne('/api/faqs?lang=es&offset=100&limit=100').flush([FAQ]);

    await expect(all).resolves.toHaveLength(101);
  });

  it('gets one question by its id', async () => {
    const one = faqs.get('faq-1', 'es');
    http.expectOne('/api/faqs/faq-1?lang=es').flush(FAQ);

    await expect(one).resolves.toEqual(FAQ);
  });

  it('turns the HTTP error into an ApiError', async () => {
    const one = faqs.get('missing', 'es');
    http
      .expectOne('/api/faqs/missing?lang=es')
      .flush(
        { '@type': 'Error', code: 'FAQ_NOT_FOUND', reason: 'Not found', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(one).rejects.toBeInstanceOf(ApiError);
  });
});
