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

  it('shows times, free seats, route and the passenger pickup address', () => {
    const root = render(TRIP);

    expect(text(root, '.trip-card__times')).toBe('07:40 → 08:12');
    expect(text(root, '.trip-card__seats')).toBe('2 plazas');
    expect(text(root, '.trip-card__route')).toBe('Roquetas de Mar → Campus UAL · Parking P1');
    expect(root.textContent).toContain('Recogida en Av. Carlos III, 12 · sale a las 07:40');
  });

  it('shows who drives', () => {
    const root = render(TRIP);

    expect(text(root, 'app-trip-driver .trip-driver__name')).toBe('Lucía Cortés');
  });

  it('links the card to the trip detail with a label that describes the trip', () => {
    const root = render(TRIP);
    const link = root.querySelector<HTMLAnchorElement>('ion-card .trip-card__link');

    expect(link?.getAttribute('href')).toBe('/tabs/search/trips/trip-1');
    expect(link?.getAttribute('aria-label')).toBe(
      'Ver viaje de Lucía: 07:40 → 08:12, Roquetas de Mar → Campus UAL · Parking P1',
    );
    expect(link?.contains(root.querySelector('app-trip-driver'))).toBe(false);
  });

  it('describes the stop as a drop-off on return trips', () => {
    const root = render({ ...TRIP, direction: 'from-campus' });

    expect(root.textContent).toContain('Bajada en Av. Carlos III, 12 · sale a las 07:40');
  });

  it('marks the last seat', () => {
    const root = render({ ...TRIP, freeSeats: 1 });

    expect(text(root, '.trip-card__seats--last')).toBe('Última plaza');
  });

  it('shows a trip already requested instead of its seats, also to screen readers', () => {
    const root = render({ ...TRIP, freeSeats: 1 }, { isRequested: true });

    expect(text(root, '.trip-card__seats--requested')).toBe('Ya solicitado');
    expect(root.querySelector('.trip-card__seats--last')).toBeNull();
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
