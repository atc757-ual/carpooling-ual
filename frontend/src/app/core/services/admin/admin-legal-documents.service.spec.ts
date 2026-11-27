import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import {
  AdminLegalDocument,
  AdminLegalDocumentsService,
  LegalDraftChanges,
} from './admin-legal-documents.service';

const CHANGES: LegalDraftChanges = {
  content: '<p>Condiciones</p>',
  changeType: 'minor',
  summary: 'Aclaración',
  contentEn: '<p>Terms</p>',
  summaryEn: 'Clarification',
};

const DOCUMENT: AdminLegalDocument = {
  id: 'doc-1',
  type: 'terms',
  version: '1.1',
  content: CHANGES.content,
  changeType: CHANGES.changeType,
  summary: CHANGES.summary,
  contentEn: CHANGES.contentEn,
  summaryEn: CHANGES.summaryEn,
  status: 'draft',
  publishedAt: null,
  updatedAt: '2026-11-20T10:00:00.000Z',
};

describe('AdminLegalDocumentsService', () => {
  let service: AdminLegalDocumentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminLegalDocumentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists every version of a legal document', async () => {
    const versions = service.versions('terms');
    const request = http.expectOne('/api/admin/legal-documents?type=terms&limit=100');

    expect(request.request.method).toBe('GET');
    request.flush([DOCUMENT]);

    await expect(versions).resolves.toEqual([DOCUMENT]);
  });

  it('saves a draft and publishes it', async () => {
    const saved = service.saveDraft('terms', CHANGES);
    const saveRequest = http.expectOne('/api/admin/legal-documents/terms/draft');
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body).toEqual(CHANGES);
    saveRequest.flush(DOCUMENT);
    await expect(saved).resolves.toEqual(DOCUMENT);

    const published = service.publish('terms');
    const publishRequest = http.expectOne('/api/admin/legal-documents/terms/draft/publish');
    expect(publishRequest.request.method).toBe('POST');
    expect(publishRequest.request.body).toEqual({});
    publishRequest.flush({ ...DOCUMENT, status: 'published', publishedAt: DOCUMENT.updatedAt });
    await expect(published).resolves.toMatchObject({ status: 'published' });
  });

  it('converts an API failure into an ApiError', async () => {
    const versions = service.versions('terms');
    http
      .expectOne('/api/admin/legal-documents?type=terms&limit=100')
      .flush(
        { '@type': 'Error', code: 'LEGAL_DOCUMENT_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(versions).rejects.toBeInstanceOf(ApiError);
    await expect(versions).rejects.toMatchObject({ code: 'LEGAL_DOCUMENT_NOT_FOUND' });
  });
});
