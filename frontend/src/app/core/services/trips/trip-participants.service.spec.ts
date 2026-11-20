import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { TripParticipantsService } from './trip-participants.service';

describe('TripParticipantsService', () => {
  let participants: TripParticipantsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    participants = TestBed.inject(TripParticipantsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the profile of whom the user travels with', async () => {
    const profile = participants.getProfile('t1', 'u2');
    http
      .expectOne('/api/trips/t1/participants/u2')
      .flush({ id: 'u2', name: 'Lucía Martín', email: 'lucia@ual.es' });

    await expect(profile).resolves.toMatchObject({ name: 'Lucía Martín' });
  });

  it('throws an ApiError when they do not share the trip', async () => {
    const profile = participants.getProfile('t1', 'u3');
    http
      .expectOne('/api/trips/t1/participants/u3')
      .flush({ code: 'PARTICIPANT_PROFILE_FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });

    await expect(profile).rejects.toBeInstanceOf(ApiError);
    await expect(profile).rejects.toMatchObject({ code: 'PARTICIPANT_PROFILE_FORBIDDEN' });
  });

  it('lists the co-passengers of the trip', async () => {
    const coPassengers = participants.listCoPassengers('t1');
    http
      .expectOne('/api/trips/t1/participants')
      .flush([{ id: 'u3', name: 'Ana', avatarKey: null }]);

    await expect(coPassengers).resolves.toEqual([{ id: 'u3', name: 'Ana', avatarKey: null }]);
  });

  it('throws an ApiError when the user has no seat', async () => {
    const coPassengers = participants.listCoPassengers('t1');
    http
      .expectOne('/api/trips/t1/participants')
      .flush({ code: 'PARTICIPANT_PROFILE_FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });

    await expect(coPassengers).rejects.toBeInstanceOf(ApiError);
  });
});
