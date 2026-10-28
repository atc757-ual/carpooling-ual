import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { DriverTripCard } from './driver-trip-card';

const TRIP: DriverTrip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 3,
  maxDetourMin: 10,
  status: 'published',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
};

function request(status: SeatRequest['status'], isPriority = false): SeatRequest {
  return {
    id: `r-${status}`,
    trip: { id: 't1' },
    passenger: { id: 'p1', name: 'Mario Pérez' },
    status,
    isPriority,
    seats: 2,
    requestedAt: '2099-01-14T10:00:00.000Z',
    vehiclePlate: null,
  };
}

describe('DriverTripCard', () => {
  let fixture: ComponentFixture<DriverTripCard>;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;
  let changed: number;

  async function render(trip: DriverTrip, requests: SeatRequest[] = []): Promise<HTMLElement> {
    driver = {
      listTripRequests: vi.fn().mockResolvedValue(requests),
      decideRequest: vi.fn().mockResolvedValue(request('accepted')),
    };
    toast = { showSuccess: vi.fn(), showError: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DriverTripCard],
      providers: [
        provideIonicAngular(),
        { provide: DriverService, useValue: driver },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(DriverTripCard);
    fixture.componentRef.setInput('trip', trip);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the route, the status and the free seats', async () => {
    const root = await render(TRIP);

    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL · Parking P1 (Sur)');
    expect(root.textContent).toContain('Publicado');
    expect(root.textContent).toContain('3 de 3 libres');
    expect(root.textContent).toContain('Aún no hay solicitudes');
  });

  it('names the places generically when the trip has no names', async () => {
    const root = await render({ ...TRIP, originName: null, destinationName: null });

    expect(root.textContent).toContain('Origen → Destino');
  });

  it('lists the pending and accepted requests, and hides the closed ones', async () => {
    const root = await render(TRIP, [
      request('pending', true),
      request('accepted'),
      request('rejected'),
    ]);

    expect(fixture.componentInstance.visibleRequests().map(({ status }) => status)).toEqual([
      'pending',
      'accepted',
    ]);
    expect(root.textContent).toContain('2 plazas · Prioridad');
    expect(root.textContent).toContain('Aceptada');
  });

  it('accepts a request and says so', async () => {
    await render(TRIP, [request('pending')]);

    await fixture.componentInstance.handleDecide(request('pending'), 'accept');

    expect(driver['decideRequest']).toHaveBeenCalledWith('r-pending', 'accept');
    expect(toast['showSuccess']).toHaveBeenCalledWith('Has aceptado la solicitud de Mario Pérez.');
    expect(changed).toBe(1);
    expect(fixture.componentInstance.deciding()).toBeNull();
  });

  it('shows the API error when the decision fails', async () => {
    await render(TRIP, [request('pending')]);
    driver['decideRequest'].mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleDecide(request('pending'), 'reject');

    expect(toast['showError']).toHaveBeenCalled();
    expect(changed).toBe(0);
  });

  it('does not load requests of a finished trip', async () => {
    const root = await render({ ...TRIP, status: 'finished' });

    expect(driver['listTripRequests']).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Finalizado');
    expect(root.querySelector('.driver-trip__requests')).toBeNull();
  });
});
