import { provideAppTransloco } from '../../i18n/testing-transloco';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../models/api-error.model';
import { LegalDocumentsService } from './legal-documents.service';

describe('LegalDocumentsService', () => {
  let documents: LegalDocumentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAppTransloco(), provideHttpClient(), provideHttpClientTesting()],
    });
    documents = TestBed.inject(LegalDocumentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the current version of a document', async () => {
    const terms = documents.getCurrent('terms');
    http
      .expectOne('/api/legal-documents/terms?lang=es')
      .flush({ type: 'terms', version: '1.1', content: '<p>Hola</p>', publishedAt: null });
    await expect(terms).resolves.toMatchObject({ version: '1.1', content: '<p>Hola</p>' });
  });

  it('asks for the text in the language of the app', async () => {
    TestBed.inject(TranslocoService).setActiveLang('en');
    const terms = documents.getCurrent('terms');
    http
      .expectOne('/api/legal-documents/terms?lang=en')
      .flush({ type: 'terms', version: '1.1', lang: 'en', content: '<p>Hello</p>' });

    await expect(terms).resolves.toMatchObject({ lang: 'en', content: '<p>Hello</p>' });
  });

  it('lists what is pending and accepts a version', async () => {
    const pending = documents.pending();
    http
      .expectOne('/api/users/me/legal-documents/pending')
      .flush([{ type: 'privacy', version: '1.2' }]);
    await expect(pending).resolves.toEqual([{ type: 'privacy', version: '1.2' }]);

    const accepted = documents.accept({ type: 'privacy', version: '1.2' });
    const request = http.expectOne('/api/users/me/legal-acceptances');
    expect(request.request.body).toEqual({ type: 'privacy', version: '1.2' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(accepted).resolves.toBeUndefined();
  });

  it('turns errors into ApiError', async () => {
    const outdated = documents.accept({ type: 'terms', version: '1.0' });
    http
      .expectOne('/api/users/me/legal-acceptances')
      .flush({ code: 'LEGAL_DOCUMENT_OUTDATED' }, { status: 409, statusText: 'Conflict' });
    await expect(outdated).rejects.toBeInstanceOf(ApiError);
  });
});
