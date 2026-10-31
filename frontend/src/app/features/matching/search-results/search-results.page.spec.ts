import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripMatch } from '../../../core/models/trip-match.model';
import { TripSearch } from '../../../core/models/trip-search.model';
import { LocationService } from '../../../core/services/location/location.service';
import { MatchingService } from '../../../core/services/matching/matching.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import {
  PARKING_P1,
  PLACES_SERVICE_STUB,
  ROQUETAS,
  stubIntersectionObserver,
} from '../trip-search.testing';
import { TripSearchStateService } from '../trip-search-state.service';
import { SearchResultsPage } from './search-results.page';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

const MATCH: TripMatch = {
  id: 't1',
  driver: { id: 'd1', name: 'Lucía Cortés', avatarKey: 'sun' },
  departureAt: '2026-10-27T06:30:00.000Z',
  arrivalAt: '2026-10-27T07:02:00.000Z',
  availableSeats: 2,
  detourMin: 3,
  timeDifferenceMin: -2,
  score: 0.9,
  vehicle: { brand: 'Seat', model: 'Ibiza', color: 'white' },
};

const EARLIER_MATCH: TripMatch = {
  ...MATCH,
  id: 'earlier',
  departureAt: '2026-10-27T06:20:00.000Z',
  arrivalAt: '2026-10-27T06:58:00.000Z',
  detourMin: 10,
};

const LOWER_DETOUR_MATCH: TripMatch = {
  ...MATCH,
  id: 'lower-detour',
  departureAt: '2026-10-27T06:35:00.000Z',
  arrivalAt: '2026-10-27T07:10:00.000Z',
  detourMin: 1,
};

describe('SearchResultsPage', () => {
  let searchState: TripSearchStateService;
  let search: ReturnType<typeof vi.fn>;

  async function setUp(
    current: TripSearch | null,
    // Se crea al llamar a la API (una promesa rechazada creada antes quedaría
    // sin capturar)
    matches: () => Promise<TripMatch[]> = () => Promise.resolve([MATCH]),
  ): Promise<ComponentFixture<SearchResultsPage>> {
    sessionStorage.clear();
    stubIntersectionObserver();
    search = vi.fn().mockImplementation(matches);
    TestBed.configureTestingModule({
      imports: [SearchResultsPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AvatarsService, useValue: { getGraphic: () => Promise.resolve(null) } },
        { provide: PlacesService, useValue: PLACES_SERVICE_STUB },
        { provide: MatchingService, useValue: { search } },
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
    const fixture = TestBed.createComponent(SearchResultsPage);
    await fixture.whenStable();
    return fixture;
  }

  it('searches and shows the compatible trips with the search summary', async () => {
    const fixture = await setUp(SEARCH);
    const page = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ parkingId: 'p1', direction: 'to-campus', marginMin: 20, seats: 1 }),
    );
    expect(root.querySelector('app-trip-result-card')?.textContent).toContain('Lucía Cortés');
    expect(root.querySelector('app-trip-result-card')?.textContent).toContain('Nuevo conductor');
    expect(root.textContent).toContain('1 en tu margen (± 20 min)');
    expect(root.textContent).toContain('Llegada más temprana');
    expect(root.textContent).toContain('Menos desvío');
    expect(root.textContent).toContain(
      'La hora de llegada es estimada. Verificamos el correo UAL, no la identidad ni el permiso de conducir.',
    );
    expect(searchState.results().map(({ id }) => id)).toEqual(['t1']);
    expect(page.stops().map(({ name }) => name)).toEqual([ROQUETAS.name, 'Campus UAL']);
    expect(page.details()).toContain('llegada 08:00 ± 20 min · 1 plaza');
  });

  it('sorts by earliest arrival by default and by detour on request', async () => {
    const fixture = await setUp(SEARCH, () =>
      Promise.resolve([MATCH, LOWER_DETOUR_MATCH, EARLIER_MATCH]),
    );
    const page = fixture.componentInstance;

    expect(page.sortedTrips().map(({ id }) => id)).toEqual(['earlier', 't1', 'lower-detour']);

    page.handleSortChange('detour');

    expect(page.sortedTrips().map(({ id }) => id)).toEqual(['lower-detour', 't1', 'earlier']);
  });

  it('reverses the route when coming back from the campus', async () => {
    const page = (await setUp({ ...SEARCH, direction: 'from-campus', seats: 2 })).componentInstance;

    expect(page.stops().map(({ name }) => name)).toEqual(['Campus UAL', ROQUETAS.name]);
    expect(page.details()).toContain('salida 08:00 ± 20 min · 2 plazas');
  });

  it('says there are no trips yet and widens the margin', async () => {
    const fixture = await setUp({ ...SEARCH, margin: 10 }, () => Promise.resolve([]));
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Aún no hay viajes para esa hora');
    expect(root.textContent).toContain('Ampliar margen a ± 15 min');

    fixture.componentInstance.handleWidenMargin();
    await fixture.whenStable();

    expect(searchState.search()?.margin).toBe(15);
    expect(search).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.widerMargin()).toBe(20);
  });

  it('shows the error and searches again', async () => {
    const fixture = await setUp(SEARCH, () => Promise.reject(new Error('down')));
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No hemos podido buscar viajes');

    search.mockResolvedValue([MATCH]);
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();

    expect(root.querySelector('app-trip-result-card')).not.toBeNull();
  });

  it('invites to search when there is no search', async () => {
    const fixture = await setUp(null);
    const root = fixture.nativeElement as HTMLElement;

    expect(search).not.toHaveBeenCalled();
    expect(fixture.componentInstance.stops()).toEqual([]);
    expect(fixture.componentInstance.details()).toBe('');
    expect(root.textContent).toContain('Aún no has buscado ningún viaje');
  });

  it('opens the window to edit the search', async () => {
    const page = (await setUp(SEARCH)).componentInstance;

    page.isEditing.set(true);

    expect(page.isEditing()).toBe(true);
  });
});
