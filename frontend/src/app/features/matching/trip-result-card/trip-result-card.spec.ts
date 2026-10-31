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
  function render(trip: TripResult): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TripResultCard],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: AvatarsService, useValue: { getSvg: () => Promise.resolve(null) } },
      ],
    });
    const fixture = TestBed.createComponent(TripResultCard);
    fixture.componentRef.setInput('trip', trip);
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
    expect(root.textContent).toContain('Desvío de 3 min para recogerte · Av. Carlos III, 12');
  });

  it('shows who drives', () => {
    const root = render(TRIP);

    expect(text(root, 'app-trip-driver .trip-driver__name')).toBe('Lucía Cortés');
  });

  it('makes the full card a link to the trip detail', () => {
    const root = render(TRIP);
    const link = root.querySelector<HTMLAnchorElement>('.trip-card__link');

    expect(link?.getAttribute('href')).toBe('/tabs/search/trips/trip-1');
    expect(link?.querySelector('ion-card')).not.toBeNull();
  });

  it('describes the stop as a drop-off on return trips', () => {
    const root = render({ ...TRIP, direction: 'from-campus' });

    expect(root.textContent).toContain('Desvío de 3 min para dejarte · Av. Carlos III, 12');
  });

  it('marks the last seat', () => {
    const root = render({ ...TRIP, freeSeats: 1 });

    expect(text(root, '.trip-card__seats--last')).toBe('Última plaza');
  });
});
