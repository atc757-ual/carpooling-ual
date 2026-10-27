import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { TripResult } from '../../../core/models/trip-result.model';
import { getInitials, TripResultCard } from './trip-result-card';

const TRIP: TripResult = {
  id: 'trip-1',
  departureTime: '07:40',
  arrivalTime: '08:12',
  origin: 'Roquetas de Mar',
  destination: 'Campus UAL · Ingreso norte',
  driver: { name: 'Lucía Cortés', tripCount: 42, rating: 4.8, isEmailVerified: true },
  freeSeats: 2,
  pickupDetourMinutes: 3,
};

describe('TripResultCard', () => {
  function render(trip: TripResult): HTMLElement {
    TestBed.configureTestingModule({
      imports: [TripResultCard],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(TripResultCard);
    fixture.componentRef.setInput('trip', trip);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, selector: string): string | undefined =>
    root.querySelector(selector)?.textContent?.trim();

  it('shows the times, the free seats, the route and the pick-up detour', () => {
    const root = render(TRIP);

    expect(text(root, '.trip-card__times')).toBe('07:40 → 08:12');
    expect(text(root, '.trip-card__seats')).toBe('2 plazas');
    expect(text(root, '.trip-card__route')).toBe('Roquetas de Mar → Campus UAL · Ingreso norte');
    expect(root.textContent).toContain('Desvío de recogida: 3 min');
  });

  it('shows the driver with the initials, the trips and the rating', () => {
    const root = render(TRIP);

    expect(text(root, '.trip-card__avatar')).toBe('LC');
    expect(text(root, '.trip-card__name')).toBe('Lucía Cortés');
    expect(root.textContent).toContain('42 viajes · Correo UAL verificado');
    expect(root.querySelector('.trip-card__rating')?.getAttribute('aria-label')).toBe(
      'Valoración 4,8 de 5',
    );
  });

  it('links to the trip with the name of the driver', () => {
    const root = render(TRIP);
    const button = root.querySelector('ion-button');

    expect(button?.textContent?.trim()).toBe('Ver viaje de Lucía');
    expect(button?.getAttribute('href')).toBe('/tabs/search/trips/trip-1');
  });

  it('marks the last seat and leaves out an unverified email', () => {
    const root = render({
      ...TRIP,
      freeSeats: 1,
      driver: { ...TRIP.driver, tripCount: 1, isEmailVerified: false },
    });

    expect(root.querySelector('.trip-card__seats--last')?.textContent?.trim()).toBe('Última plaza');
    expect(root.textContent).toContain('1 viaje');
    expect(root.textContent).not.toContain('Correo UAL verificado');
  });
});

describe('getInitials', () => {
  it.each([
    ['Lucía Cortés', 'LC'],
    ['javier pardo gil', 'JP'],
    ['  Sara  ', 'S'],
  ])('turns %s into %s', (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});
