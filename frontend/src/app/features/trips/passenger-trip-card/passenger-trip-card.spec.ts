import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { passengerTrip } from './passenger-trip.testing';
import { PassengerTrip } from '../my-trips/trip-entries';
import { TripsTab } from '../my-trips/trip-tabs';
import { PassengerTripCard } from './passenger-trip-card';

describe('PassengerTripCard', () => {
  let fixture: ComponentFixture<PassengerTripCard>;

  function render(item: PassengerTrip, tab: TripsTab = 'upcoming'): HTMLElement {
    TestBed.configureTestingModule({
      imports: [PassengerTripCard],
      providers: [provideIonicAngular(), provideRouter([])],
    });
    fixture = TestBed.createComponent(PassengerTripCard);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('tab', tab);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const next = (root: HTMLElement): string | undefined =>
    root.querySelector('.passenger-trip__next')?.textContent ?? undefined;

  it('shows the trip with its role, status and details', () => {
    const root = render(passengerTrip('accepted', 'confirmed'));

    expect(root.querySelector('.role-tag')?.textContent).toContain('Viajas');
    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL · Parking P1 (Sur)');
    expect(root.textContent).toContain('Conduce Lucía Cortés · 2 plazas · Matrícula 1234BCD');
    expect(root.querySelector('.status--accepted')?.textContent).toContain('Confirmada');
  });

  it('links to its request and leaves cancelling to the detail', () => {
    const root = render(passengerTrip('pending', 'published'));
    const link = root.querySelector('.passenger-trip__link');

    expect(link?.getAttribute('href')).toBe('/tabs/trips/requests/r1');
    expect(link?.getAttribute('aria-label')).toContain('Ver solicitud, viajas:');
    expect(link?.getAttribute('aria-label')).toContain('Pendiente');
    expect(root.querySelector('.status--pending')).not.toBeNull();
    expect(root.textContent).not.toContain('Cancelar solicitud');
  });

  it('says the next step: who to wait for or when the pickup is', () => {
    expect(next(render(passengerTrip('pending', 'published')))).toBe(
      'Esperando respuesta de Lucía',
    );
    TestBed.resetTestingModule();
    expect(
      next(render(passengerTrip('accepted', 'confirmed', { pickupAt: '2099-01-15T06:50:00Z' }))),
    ).toContain('Confirmada: te recoge a las');
    TestBed.resetTestingModule();
    expect(next(render(passengerTrip('accepted', 'confirmed')))).toBe(
      'Confirmada: viajas con Lucía',
    );
  });

  it('has no next step once the trip is over, and gives the reason when not made', () => {
    expect(next(render(passengerTrip('accepted', 'finished'), 'past'))).toBeUndefined();
    TestBed.resetTestingModule();
    const root = render(
      passengerTrip('cancelled', 'finished', { rejectionReason: 'no_show' }),
      'cancelled',
    );
    expect(root.textContent).toContain('No te presentaste');
    expect(root.querySelector('.status--accepted')).toBeNull();
    expect(root.querySelector('.status--danger')?.textContent).toContain('No te presentaste');
  });
});
