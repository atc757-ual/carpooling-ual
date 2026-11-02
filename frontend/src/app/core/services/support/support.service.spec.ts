import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let support: SupportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    support = TestBed.inject(SupportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the topic and the message', async () => {
    const sending = support.sendMessage('trip', 'El conductor no ha llegado a la recogida.');
    const request = http.expectOne('/api/support/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      topic: 'trip',
      message: 'El conductor no ha llegado a la recogida.',
    });
    request.flush(null, { status: 202, statusText: 'Accepted' });

    await expect(sending).resolves.toBeUndefined();
  });

  it('throws an ApiError when it fails', async () => {
    const sending = support.sendMessage('bug', 'Algo ha fallado al publicar un viaje.');
    http
      .expectOne('/api/support/messages')
      .flush(
        { '@type': 'Error', code: 'VALIDATION_FAILED', status: '400' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(sending).rejects.toBeInstanceOf(ApiError);
  });
});
