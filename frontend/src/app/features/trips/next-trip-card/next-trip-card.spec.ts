import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { passengerTrip } from '../passenger-trip-card/passenger-trip.testing';
import { NextTripCard } from './next-trip-card';

describe('NextTripCard', () => {
  async function render(options: {
    profiles: ('driver' | 'passenger')[];
    driven?: DriverTrip[];
    requestStatus?: 'pending' | 'accepted';
    tripStatus?: DriverTrip['status'];
  }) {
    const ride = passengerTrip(
      options.requestStatus ?? 'accepted',
      options.tripStatus ?? 'confirmed',
    );
    const listMyTrips = vi.fn().mockResolvedValue(options.driven ?? []);
    const listMine = vi.fn().mockResolvedValue(options.requestStatus ? [ride.request] : []);
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 'u1' }),
            hasProfile: (profile: 'driver' | 'passenger') => options.profiles.includes(profile),
          },
        },
        { provide: DriverService, useValue: { listMyTrips } },
        { provide: SeatRequestsService, useValue: { listMine } },
        { provide: TripsService, useValue: { getTrip: vi.fn().mockResolvedValue(ride.trip) } },
      ],
    });
    const fixture = TestBed.createComponent(NextTripCard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, listMyTrips, listMine };
  }

  const driverTrip = (status: DriverTrip['status']): DriverTrip =>
    ({
      ...passengerTrip('accepted', status).trip,
      id: 't9',
      requests: [],
    }) as unknown as DriverTrip;

  it('shows the passenger seat with the chat and the open buttons', async () => {
    const { root, listMyTrips } = await render({
      profiles: ['passenger'],
      requestStatus: 'accepted',
    });

    expect(listMyTrips).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Próximo viaje');
    expect(root.textContent).toContain('Viajas');
    expect(root.textContent).toContain('Confirmada');
    const links = root.querySelectorAll<HTMLAnchorElement>('a.icon-btn--reveal');
    expect([...links].map((link) => link.getAttribute('aria-label'))).toEqual([
      'Chat con el conductor',
      'Ver tu plaza',
    ]);
    expect(links[0].getAttribute('href')).toBe('/tabs/messages/t1');
    expect(links[1].getAttribute('href')).toBe('/tabs/trips/requests/r1');
  });

  it('gives no chat while the seat is pending', async () => {
    const { root } = await render({ profiles: ['passenger'], requestStatus: 'pending' });

    expect(root.textContent).toContain('Pendiente');
    expect(root.querySelector('a[aria-label="Chat con el conductor"]')).toBeNull();
  });

  it('shows the driver trip, and reloads on demand', async () => {
    const { fixture, root, listMyTrips, listMine } = await render({
      profiles: ['driver'],
      driven: [driverTrip('confirmed')],
    });

    expect(listMine).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Conduces');
    expect(root.querySelector('a[aria-label="Ver tu viaje"]')?.getAttribute('href')).toBe(
      '/tabs/trips/published/t9',
    );

    fixture.componentInstance.reload();
    await fixture.whenStable();
    expect(listMyTrips).toHaveBeenCalledTimes(2);
  });

  it('shows the live trip banner while the trip is running', async () => {
    const { root } = await render({ profiles: ['driver'], driven: [driverTrip('in_progress')] });

    expect(root.querySelector('app-live-trip-banner')).not.toBeNull();
    expect(root.querySelector('.next-trip')).toBeNull();
    expect(root.textContent).toContain('plazas ocupadas');
  });

  it('shows nothing without an upcoming trip', async () => {
    const { root } = await render({ profiles: ['driver', 'passenger'] });

    expect(root.querySelector('.next-trip')).toBeNull();
    expect(root.querySelector('app-live-trip-banner')).toBeNull();
  });
});
