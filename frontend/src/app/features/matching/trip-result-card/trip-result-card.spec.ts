import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { TripResult } from '../../../core/models/trip-result.model';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { TripResultCard } from './trip-result-card';

const TRIP: TripResult = {
  id: 'trip-1',
  direction: 'to-campus',
  arrivalAt: '2026-10-27T08:12:00.000Z',
  departureTime: '07:40',
  arrivalTime: '08:12',
  origin: 'Roquetas de Mar',
  destination: 'Campus UAL · Parking P1',
  driver: {
    name: 'Lucía Cortés',
    avatarKey: null,
    tripCount: 42,
    rating: 4.8,
    isEmailVerified: true,
  },
  freeSeats: 2,
  pickupDetourMinutes: 3,
  passengerStop: 'Av. Carlos III, 12',
};

describe('TripResultCard', () => {
  function render(
    trip: TripResult,
    flags: { isRequested?: boolean; isBestMatch?: boolean } = {},
  ): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TripResultCard],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AvatarsService, useValue: { getGraphic: () => Promise.resolve(null) } },
      ],
    });
    const fixture = TestBed.createComponent(TripResultCard);
    fixture.componentRef.setInput('trip', trip);
    fixture.componentRef.setInput('isRequested', flags.isRequested ?? false);
    fixture.componentRef.setInput('isBestMatch', flags.isBestMatch ?? false);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, selector: string): string | undefined =>
    root.querySelector(selector)?.textContent?.trim();

  it('shows times, free seats, route, the detour and when it leaves', () => {
    const root = render(TRIP);

    expect(text(root, '.trip-card__times')).toBe('07:40 → 08:12');
    expect(text(root, '.trip-card__seats')).toBe('2 plazas');
    expect(text(root, '.trip-card__route')).toBe('Roquetas de Mar → Campus UAL · Parking P1');
    expect(text(root, '.trip-card__pickup')).toBe('Desvío de 3 min · sale a las 07:40');
    expect(root.querySelector('.trip-card')?.classList).toBeTruthy();
  });

  it('says the trip is on its way when there is no detour', () => {
    const root = render({ ...TRIP, pickupDetourMinutes: 0 });

    expect(text(root, '.trip-card__pickup')).toBe('En su ruta · sale a las 07:40');
  });

  it('gives the pickup time and, at stops, the stop and the walk', () => {
    const atPoint = render({ ...TRIP, pickupTime: '07:52' });
    expect(text(atPoint, '.trip-card__pickup')).toBe('Desvío de 3 min · te recoge a las 07:52');

    TestBed.resetTestingModule();
    const atStop = render({
      ...TRIP,
      pickupTime: '07:52',
      pickupStop: { id: 's1', name: 'Av. Cabo de Gata', walkingDistanceM: 347 },
    });
    expect(text(atStop, '.trip-card__pickup')).toBe(
      'En la parada Av. Cabo de Gata (a 350 m) · a las 07:52',
    );
  });

  it('shows only the name of who drives (the rest, in the detail)', () => {
    const root = render(TRIP);

    expect(text(root, '.trip-card__driver')).toBe('Conduce Lucía Cortés');
    expect(root.querySelector('app-trip-driver')).toBeNull();
  });

  it('links the row to the trip detail with a label that describes the trip', () => {
    const root = render(TRIP);
    const link = root.querySelector<HTMLAnchorElement>('.trip-card__link');

    expect(link?.getAttribute('href')).toBe('/tabs/search/trips/trip-1');
    expect(link?.getAttribute('aria-label')).toBe(
      'Ver viaje de Lucía: 07:40 → 08:12, Roquetas de Mar → Campus UAL · Parking P1',
    );
  });

  it('marks the last seat', () => {
    const root = render({ ...TRIP, freeSeats: 1 });

    expect(text(root, '.status--pending')).toBe('Última plaza');
    expect(root.querySelector('.trip-card__seats')).toBeNull();
  });

  it('shows a trip already requested instead of its seats, also to screen readers', () => {
    const root = render({ ...TRIP, freeSeats: 1 }, { isRequested: true });

    expect(text(root, '.status--info')).toBe('Ya solicitado');
    expect(root.querySelector('.status--pending')).toBeNull();
    expect(root.querySelector('.trip-card__link')?.getAttribute('aria-label')).toContain(
      ', ya solicitado',
    );
  });

  it('highlights the best match only when told to', () => {
    expect(render(TRIP).querySelector('.trip-card__best')).toBeNull();
    TestBed.resetTestingModule();
    expect(text(render(TRIP, { isBestMatch: true }), '.trip-card__best')).toBe('Mejor opción');
  });
});
