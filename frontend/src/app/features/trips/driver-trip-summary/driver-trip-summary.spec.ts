import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverTripSummary } from './driver-trip-summary';

const TRIP = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 2,
  status: 'published',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL',
} as DriverTrip;

describe('DriverTripSummary', () => {
  let start: ReturnType<typeof vi.fn>;

  function render(trip: DriverTrip, pendingCount = 0): HTMLElement {
    start = vi.fn();
    TestBed.configureTestingModule({
      imports: [DriverTripSummary],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: DriverTrackingService, useValue: { start } },
      ],
    });
    const fixture = TestBed.createComponent(DriverTripSummary);
    fixture.componentRef.setInput('trip', trip);
    fixture.componentRef.setInput('pendingCount', pendingCount);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const link = (root: HTMLElement) => root.querySelector('.driver-summary__link');

  it('shows the route, the free seats and links to the detail', () => {
    const root = render(TRIP);

    expect(root.querySelector('.driver-summary__route')?.textContent).toBe(
      'Roquetas de Mar → Campus UAL',
    );
    expect(root.textContent).toContain('2 de 3 libres');
    expect(link(root)?.getAttribute('href')).toBe('/tabs/trips/published/t1');
    expect(link(root)?.textContent).toBe('Ver solicitudes');
    expect(link(root)?.getAttribute('aria-label')).toContain('Ver solicitudes:');
    expect(start).not.toHaveBeenCalled();
  });

  it('falls back to generic names without place names', () => {
    const root = render({ ...TRIP, originName: null, destinationName: null } as DriverTrip);

    expect(root.querySelector('.driver-summary__route')?.textContent).toBe('Origen → Destino');
  });

  it('offers to start when the departure is close', () => {
    const departureAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    expect(link(render({ ...TRIP, status: 'confirmed', departureAt }))?.textContent).toBe(
      'Iniciar viaje',
    );
  });

  it('keeps showing the requests while it is too early to start', () => {
    expect(link(render({ ...TRIP, status: 'confirmed' }))?.textContent).toBe('Ver solicitudes');
  });

  it('opens the live screen of a trip in progress and keeps sharing the position', () => {
    const root = render({ ...TRIP, status: 'in_progress' });

    expect(link(root)?.getAttribute('href')).toBe('/tabs/trips/drive/t1');
    expect(link(root)?.textContent).toBe('Abrir viaje');
    expect(start).toHaveBeenCalledWith('t1');
  });

  it('just opens the trip once it is over', () => {
    expect(link(render({ ...TRIP, status: 'finished' }))?.textContent).toBe('Ver viaje');
  });

  it('counts the requests waiting for an answer', () => {
    expect(render(TRIP).querySelector('.driver-summary__pending')).toBeNull();
    TestBed.resetTestingModule();
    expect(render(TRIP, 1).querySelector('.driver-summary__pending')?.textContent).toBe(
      '1 solicitud por responder',
    );
    TestBed.resetTestingModule();
    expect(render(TRIP, 2).querySelector('.driver-summary__pending')?.textContent).toBe(
      '2 solicitudes por responder',
    );
  });
});
