import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { TripSearch } from '../../../core/models/trip-search.model';
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

describe('TripSearchPage', () => {
  let searchState: TripSearchStateService;

  async function setUp(search: TripSearch | null): Promise<ComponentFixture<TripSearchPage>> {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [TripSearchPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: PlacesService, useValue: PLACES_SERVICE_STUB },
      ],
    });
    searchState = TestBed.inject(TripSearchStateService);
    if (search) {
      searchState.set(search);
    }
    const fixture = TestBed.createComponent(TripSearchPage);
    await fixture.whenStable();
    return fixture;
  }

  async function render(search: TripSearch | null): Promise<HTMLElement> {
    stubIntersectionObserver();
    return (await setUp(search)).nativeElement as HTMLElement;
  }

  it('shows the form and what will appear there without a search', async () => {
    const root = await render(null);

    expect(root.querySelector('app-trip-search-form')).not.toBeNull();
    expect(root.querySelector('app-trip-search-summary')).toBeNull();
    expect(root.textContent).toContain('Aquí verás los resultados de tu búsqueda');
  });

  it('shows the summary of the last search and an example trip', async () => {
    const root = await render(SEARCH);

    expect(root.querySelector('app-trip-search-form')).toBeNull();
    expect(root.querySelector('app-trip-search-summary')?.textContent).toContain('Roquetas de Mar');
    expect(root.querySelector('app-trip-result-card')?.textContent).toContain('Lucía Cortés');
    expect(root.textContent).toContain('Datos de ejemplo');
  });

  it('edits the search with the form, and closes it with a new search', async () => {
    const fixture = await setUp(SEARCH);
    const page = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;

    page.isEditing.set(true);
    await fixture.whenStable();

    expect(root.querySelector('app-trip-search-form')).not.toBeNull();
    expect(root.textContent).toContain('Cancelar');

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
