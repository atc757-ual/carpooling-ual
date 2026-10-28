import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { TripMatch } from '../../../core/models/trip-match.model';
import { TripSearch } from '../../../core/models/trip-search.model';
import { MatchingService } from '../../../core/services/matching/matching.service';
import { PlacesService } from '../../../core/services/places/places.service';
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

const MATCH: TripMatch = {
  id: 't1',
  driver: { id: 'd1', name: 'Lucía Cortés' },
  departureAt: '2026-10-27T06:30:00.000Z',
  arrivalAt: '2026-10-27T07:02:00.000Z',
  availableSeats: 2,
  detourMin: 3,
  timeDifferenceMin: -2,
  score: 0.9,
};

describe('TripSearchPage', () => {
  let searchState: TripSearchStateService;
  let search: ReturnType<typeof vi.fn>;

  async function setUp(
    current: TripSearch | null,
    // Se crea al llamar a la API (una promesa rechazada creada antes quedaría
    // sin capturar)
    matches: () => Promise<TripMatch[]> = () => Promise.resolve([MATCH]),
  ): Promise<ComponentFixture<TripSearchPage>> {
    sessionStorage.clear();
    stubIntersectionObserver();
    search = vi.fn().mockImplementation(matches);
    TestBed.configureTestingModule({
      imports: [TripSearchPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: PlacesService, useValue: PLACES_SERVICE_STUB },
        { provide: MatchingService, useValue: { search } },
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

  it('shows the form and what will appear there without a search', async () => {
    const root = (await setUp(null)).nativeElement as HTMLElement;

    expect(search).not.toHaveBeenCalled();
    expect(root.querySelector('app-trip-search-form')).not.toBeNull();
    expect(root.textContent).toContain('Aquí verás los resultados de tu búsqueda');
  });

  it('searches with the last search and shows the compatible trips', async () => {
    const root = (await setUp(SEARCH)).nativeElement as HTMLElement;

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ parkingId: 'p1', direction: 'to-campus', marginMin: 20, seats: 1 }),
    );
    expect(root.querySelector('app-trip-search-summary')?.textContent).toContain('Roquetas de Mar');
    expect(root.querySelector('app-trip-result-card')?.textContent).toContain('Lucía Cortés');
    expect(root.textContent).toContain('1 en tu margen (±20 min)');
    expect(searchState.results().map(({ id }) => id)).toEqual(['t1']);
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

  it('edits the search with the form, and closes it with a new search', async () => {
    const fixture = await setUp(SEARCH);
    const page = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    page.isEditing.set(true);
    await fixture.whenStable();

    expect(root.querySelector('app-trip-search-form')).not.toBeNull();

    searchState.set({ ...SEARCH, seats: 2 });
    await fixture.whenStable();

    expect(page.isEditing()).toBe(false);
    expect(root.querySelector('app-trip-search-summary')?.textContent).toContain('2 plazas');
  });

  it('starts again with the empty form for a new search', async () => {
    const fixture = await setUp(SEARCH);
    const root = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.handleNewSearch();
    await fixture.whenStable();

    expect(searchState.search()).toBeNull();
    expect(root.querySelector('app-trip-search-form')).not.toBeNull();
    expect(root.querySelector('app-trip-result-card')).toBeNull();
  });
});
