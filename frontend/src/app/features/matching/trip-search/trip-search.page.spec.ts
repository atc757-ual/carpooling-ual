import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripSearch } from '../../../core/models/trip-search.model';
import { Profile, User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { FaqsService } from '../../../core/services/help/faqs.service';
import { LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import {
  PARKING_P1,
  PLACES_SERVICE_STUB,
  ROQUETAS,
  stubIntersectionObserver,
} from '../trip-search.testing';
import { TripsService } from '../../../core/services/trips/trips.service';
import { TripSearchStateService } from '../trip-search-state.service';
import { TripSearchPage } from './trip-search.page';
import { UsualTripService } from '../usual-trip/usual-trip.service';

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
    {
      profiles = ['passenger'],
      pending = 0,
      nextTripEntries = [],
    }: { profiles?: Profile[]; pending?: number; nextTripEntries?: unknown[] } = {},
  ): Promise<ComponentFixture<TripSearchPage>> {
    sessionStorage.clear();
    stubIntersectionObserver();
    const user = signal({ firstName: 'Jimena', lastName: 'Ruiz', profiles } as User);
    const requests = Array.from({ length: pending }, (_, index) => ({
      id: `r${index}`,
      status: 'pending',
    }));
    TestBed.configureTestingModule({
      imports: [TripSearchPage],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideRouter([]),
        { provide: PlacesService, useValue: PLACES_SERVICE_STUB },
        {
          provide: UsualTripService,
          useValue: { trip: signal(null), isLoaded: signal(true) },
        },
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
          provide: TripsService,
          useValue: {
            listMyTripEntries: vi
              .fn()
              .mockResolvedValue({ items: nextTripEntries, total: nextTripEntries.length }),
            getTrip: vi.fn().mockImplementation((id: string) =>
              Promise.resolve({
                id,
                status: 'published',
                departureAt: '2026-11-26T18:00:00Z',
                origin: { name: 'Almería' },
                destination: { name: 'Campus' },
              }),
            ),
          },
        },
        {
          provide: LocationService,
          useValue: { checkPermission: () => Promise.resolve('prompt') },
        },
        { provide: FaqsService, useValue: { list: vi.fn().mockResolvedValue([]) } },
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
    'shows the search card with the questions',
    async () => {
      const root = (await setUp(null)).nativeElement as HTMLElement;

      // El saludo con el nombre va en la cabecera del layout, no en la pantalla
      expect(root.querySelector('app-trip-search-form')).not.toBeNull();
      expect(root.querySelector('app-quick-faqs')).not.toBeNull();
      expect(root.textContent).not.toContain('Nueva búsqueda');
    },
    COLD_START_TIMEOUT_MS,
  );

  it('tells how many requests wait for an answer, in amber and outside the search card', async () => {
    const root = (await setUp(null, { pending: 2 })).nativeElement as HTMLElement;

    const alert = root.querySelector<HTMLAnchorElement>('a.trip-search__pending');
    expect(alert?.textContent).toContain('Tienes 2 solicitudes esperando respuesta.');
    expect(alert?.classList).toContain('notice--warning');
    // Con varias, a Tus viajes; el aviso entero es el enlace, sin otro dentro
    expect(alert?.getAttribute('href')).toBe('/tabs/trips');
    expect(alert?.querySelector('a')).toBeNull();
    expect(root.querySelector('.trip-search__criteria a.trip-search__pending')).toBeNull();
  });

  it('takes the only waiting request straight to its detail', async () => {
    const root = (await setUp(null, { pending: 1 })).nativeElement as HTMLElement;

    const alert = root.querySelector('a.trip-search__pending');
    expect(alert?.textContent).toContain('Tienes 1 solicitud esperando respuesta.');
    expect(alert?.getAttribute('href')).toBe('/tabs/trips/requests/r0');
  });

  it('does not duplicate the waiting notice when the next trip card already shows it', async () => {
    const fixture = await setUp(null, {
      pending: 1,
      nextTripEntries: [
        {
          role: 'passenger',
          request: {
            id: 'r0',
            status: 'pending',
            trip: { id: 't0' },
          },
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('a.trip-search__pending')).toBeNull();
  });

  it('asks again for the requests and the next trip when coming back to the tab', async () => {
    const fixture = await setUp(null);
    const listMine = vi.mocked(TestBed.inject(SeatRequestsService).listMine);
    const calls = listMine.mock.calls.length;

    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();

    expect(listMine.mock.calls).toHaveLength(calls * 2);
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

    root.querySelector<HTMLButtonElement>('.search-form__new')?.click();
    await fixture.whenStable();

    expect(searchState.search()).toBeNull();
  });
});
