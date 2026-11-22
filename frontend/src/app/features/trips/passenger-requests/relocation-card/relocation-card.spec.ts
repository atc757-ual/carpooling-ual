import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../../core/models/driver.model';
import { CampusParking } from '../../../../core/models/place.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { PlacesService } from '../../../../core/services/places/places.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { TripSearchStateService } from '../../../matching/trip-search-state.service';
import {
  isRelocatable,
  nearestParking,
  RELOCATION_WINDOW_MS,
  RelocationCard,
  toRelocationSearch,
} from './relocation-card';

const MINUTE_MS = 60_000;
const NOW = Date.parse('2026-11-22T18:00:00Z');
const HOME: [number, number] = [-2.4637, 36.8381];
const NORTH: CampusParking = {
  id: 'p-north',
  name: 'Parking Norte',
  location: { type: 'Point', coordinates: [-2.405, 36.83] },
};
const SOUTH: CampusParking = {
  id: 'p-south',
  name: 'Parking Sur',
  location: { type: 'Point', coordinates: [-2.41, 36.82] },
};

function cancelled(overrides: Partial<SeatRequest> = {}): SeatRequest {
  return {
    id: 'r1',
    status: 'cancelled',
    rejectionReason: 'trip_cancelled',
    cancelledAt: new Date(NOW - 6 * MINUTE_MS).toISOString(),
    direction: 'to-campus',
    pickupLocation: { type: 'Point', coordinates: HOME },
    pickupName: 'Puerta de Purchena',
    seats: 2,
    ...overrides,
  } as SeatRequest;
}

const TRIP = {
  id: 't1',
  departureAt: '2030-11-23T07:30:00.000Z',
  origin: { type: 'Point', coordinates: HOME },
  destination: { type: 'Point', coordinates: [-2.4051, 36.8301] },
  originName: 'Almería',
  destinationName: 'Campus UAL',
} as unknown as Trip;

describe('isRelocatable', () => {
  it('only while 30 min have not passed since the driver cancelled', () => {
    const cancelledAt = Date.parse(cancelled().cancelledAt ?? '');

    expect(isRelocatable(cancelled(), cancelledAt + RELOCATION_WINDOW_MS)).toBe(true);
    expect(isRelocatable(cancelled(), cancelledAt + RELOCATION_WINDOW_MS + 1)).toBe(false);
  });

  it('not for a request cancelled by the passenger or still alive', () => {
    expect(isRelocatable(cancelled({ rejectionReason: null }), NOW)).toBe(false);
    expect(isRelocatable(cancelled({ status: 'accepted' }), NOW)).toBe(false);
    expect(isRelocatable(cancelled({ cancelledAt: null }), NOW)).toBe(false);
  });
});

describe('nearestParking', () => {
  it('is the parking closest to the point (none without parkings)', () => {
    expect(nearestParking([SOUTH, NORTH], [-2.4051, 36.8301])).toBe(NORTH);
    expect(nearestParking([], HOME)).toBeNull();
  });
});

describe('toRelocationSearch', () => {
  // Sin parking, el nombre del campus sale de las traducciones
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppTransloco()] });
    TestBed.inject(TranslocoService);
  });

  it('is the cancelled trip as a search: its point, parking, time and seats, with the request', () => {
    const search = toRelocationSearch(cancelled(), TRIP, NORTH);

    expect(search).toMatchObject({
      direction: 'to-campus',
      place: { name: 'Puerta de Purchena', coordinates: HOME },
      parking: { id: 'p-north', name: 'Parking Norte' },
      date: '2030-11-23',
      margin: 20,
      seats: 2,
      relocationRequestId: 'r1',
    });
    expect(search.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('without its pickup point or a parking, uses the trip and the campus', () => {
    const search = toRelocationSearch(
      cancelled({ pickupLocation: null, pickupName: null, direction: null }),
      TRIP,
      null,
    );

    expect(search.place).toMatchObject({ name: 'Almería', coordinates: HOME });
    expect(search.parking).toEqual({ id: '', name: 'Campus' });
  });
});

describe('RelocationCard', () => {
  let fixture: ComponentFixture<RelocationCard>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let setSearch: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;
  let loadParkings: ReturnType<typeof vi.fn>;

  function render(now = NOW): HTMLElement {
    navigateByUrl = vi.fn().mockResolvedValue(true);
    setSearch = vi.fn();
    showError = vi.fn().mockResolvedValue(undefined);
    loadParkings = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [RelocationCard],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: Router, useValue: { navigateByUrl } },
        { provide: TripSearchStateService, useValue: { set: setSearch } },
        { provide: ToastService, useValue: { showError } },
        { provide: PlacesService, useValue: { loadParkings, parkings: () => [SOUTH, NORTH] } },
      ],
    });
    fixture = TestBed.createComponent(RelocationCard);
    fixture.componentRef.setInput('request', cancelled());
    fixture.componentRef.setInput('trip', TRIP);
    fixture.componentRef.setInput('now', now);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('tells the passenger the driver cancelled and how long the option lasts', () => {
    const root = render();

    expect(root.textContent).toContain('Tu conductor ha cancelado el viaje');
    expect(root.textContent).toContain('Buscar otro viaje ahora');
    // Cancelado hace 6 min: le quedan 24
    expect(root.textContent).toContain('Disponible durante 24 min más');
  });

  it('counts at least one minute while it is shown', () => {
    render(Date.parse(cancelled().cancelledAt ?? '') + RELOCATION_WINDOW_MS - 1_000);

    expect(fixture.componentInstance.minutesLeft()).toBe(1);
  });

  it('opens Search with the cancelled trip as the search, in the parking of the trip', async () => {
    render();

    await fixture.componentInstance.handleSearch();

    expect(loadParkings).toHaveBeenCalled();
    expect(setSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        relocationRequestId: 'r1',
        parking: { id: 'p-north', name: 'Parking Norte' },
      }),
    );
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/search/results');
    expect(fixture.componentInstance.isOpening()).toBe(false);
  });

  it('says why if the parkings cannot be loaded, and stays on the screen', async () => {
    render();
    loadParkings.mockRejectedValue(new Error('offline'));

    await fixture.componentInstance.handleSearch();

    expect(showError).toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.componentInstance.isOpening()).toBe(false);
  });
});
