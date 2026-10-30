import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripSearch } from '../../../core/models/trip-search.model';
import { Profile, User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import {
  PARKING_P1,
  PLACES_SERVICE_STUB,
  ROQUETAS,
  stubIntersectionObserver,
} from '../trip-search.testing';
import { TripSearchStateService } from '../trip-search-state.service';
import { TripSearchPage } from './trip-search.page';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

// El primer test de la página la monta en frío (todos sus componentes): con
// la máquina cargada pasa de los 5 s por defecto
const COLD_START_TIMEOUT_MS = 15_000;

describe('TripSearchPage', () => {
  let searchState: TripSearchStateService;

  async function setUp(
    current: TripSearch | null,
    { profiles = ['passenger'], pending = 0 }: { profiles?: Profile[]; pending?: number } = {},
  ): Promise<ComponentFixture<TripSearchPage>> {
    sessionStorage.clear();
    stubIntersectionObserver();
    const user = signal({ name: 'Jimena Ruiz', profiles } as User);
    const requests = Array.from({ length: pending }, (_, index) => ({
      id: `r${index}`,
      status: 'pending',
    }));
    TestBed.configureTestingModule({
      imports: [TripSearchPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: PlacesService, useValue: PLACES_SERVICE_STUB },
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            hasProfile: (profile: Profile) => user().profiles.includes(profile),
          },
        },
        {
          provide: SeatRequestsService,
          useValue: { listMine: vi.fn().mockResolvedValue(requests) },
        },
        {
          provide: LocationService,
          useValue: { checkPermission: () => Promise.resolve('prompt') },
        },
      ],
    });
    searchState = TestBed.inject(TripSearchStateService);
    if (current) {
      searchState.set(current);
    }
    const fixture = TestBed.createComponent(TripSearchPage);
    await fixture.whenStable();
    return fixture;
  }

  it(
    'greets by the first name and shows the search card with the questions',
    async () => {
      const root = (await setUp(null)).nativeElement as HTMLElement;

      // El saludo va en el contenido; el título de la pantalla, en la franja fija
      expect(root.querySelector('.trip-search__hello')?.textContent).toContain('¡Hola, Jimena!');
      expect(root.querySelector('app-trip-search-form')).not.toBeNull();
      expect(root.querySelector('app-faq-card')).not.toBeNull();
      expect(root.textContent).not.toContain('Nueva búsqueda');
    },
    COLD_START_TIMEOUT_MS,
  );

  it('tells how many requests wait for an answer', async () => {
    const root = (await setUp(null, { pending: 2 })).nativeElement as HTMLElement;

    expect(root.textContent).toContain('Tienes 2 solicitudes esperando respuesta.');
  });

  it('invites to publish only to who has no car yet', async () => {
    const passenger = (await setUp(null)).nativeElement as HTMLElement;
    expect(passenger.textContent).toContain('¿Tienes coche?');

    TestBed.resetTestingModule();
    const driver = (await setUp(null, { profiles: ['passenger', 'driver'] }))
      .nativeElement as HTMLElement;
    expect(driver.textContent).not.toContain('¿Tienes coche?');
  });

  it('starts again with the empty form for a new search', async () => {
    const fixture = await setUp(SEARCH);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Nueva búsqueda');

    fixture.componentInstance.handleNewSearch();
    await fixture.whenStable();

    expect(searchState.search()).toBeNull();
  });
});
