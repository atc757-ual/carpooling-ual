import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { ChatService } from '../../../core/services/chat/chat.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { DriverTripPassengers } from './driver-trip-passengers';

const TRIP: DriverTrip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 3,
  maxDetourMin: 10,
  vehicleId: 'v1',
  origin: { type: 'Point', coordinates: [-2.6, 36.76] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
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
    answeredAt: null,
    cancelledAt: null,
    vehiclePlate: null,
  };
}

describe('DriverTripPassengers', () => {
  let fixture: ComponentFixture<DriverTripPassengers>;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;
  let changed: number;

  async function render(trip: DriverTrip, requests: SeatRequest[] = []): Promise<HTMLElement> {
    driver = {
      listTripRequests: vi.fn().mockResolvedValue(requests),
      decideRequest: vi.fn().mockResolvedValue(request('accepted')),
    };
    toast = { showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DriverTripPassengers],
      providers: [
        provideCatalogsForTests(),
        provideIonicAngular(),
        provideRouter([]),
        { provide: DriverService, useValue: driver },
        {
          provide: ChatService,
          useValue: {
            listContacts: vi
              .fn()
              .mockResolvedValue([
                { id: 'p1', name: 'Mario Pérez', phone: '+34600111222', role: 'passenger' },
              ]),
          },
        },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(DriverTripPassengers);
    fixture.componentRef.setInput('trip', trip);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the seats as taken and free, and no chat without passengers', async () => {
    const root = await render({ ...TRIP, availableSeats: 2 });

    expect(fixture.componentInstance.seats()).toEqual([true, false, false]);
    expect(root.querySelectorAll('.driver-trip__seat--taken')).toHaveLength(1);
    expect(root.textContent).toContain('1 de 3 plazas ocupadas');
    expect(root.textContent).toContain('Aún no hay solicitudes');
    expect(root.querySelector('app-trip-chat-link')).toBeNull();
  });

  it('opens the chat of the trip once it has passengers', async () => {
    const root = await render({ ...TRIP, status: 'confirmed' });

    expect(root.querySelector('app-trip-chat-link')?.textContent).toContain('Chat del viaje');
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
    expect(root.querySelector('.driver-trip__requests')).toBeNull();
  });

  it('calls an accepted passenger once the trip is confirmed', async () => {
    const root = await render({ ...TRIP, status: 'confirmed' }, [request('accepted')]);
    const tripCall = TestBed.inject(TripCallService);
    const openPhoneSpy = vi.spyOn(tripCall, 'openPhone').mockImplementation(() => undefined);

    const callBtn = root.querySelector('.driver-trip__call-btn');
    expect(callBtn?.getAttribute('title')).toBe('Llamar a Mario Pérez');
    expect(callBtn?.classList).not.toContain('driver-trip__call-btn--unavailable');

    fixture.componentInstance.handleCallPassenger({ id: 'p1', name: 'Mario Pérez' });
    expect(openPhoneSpy).toHaveBeenCalledWith('+34600111222');
  });

  it('shows the call button as unavailable while the trip is only published', async () => {
    const root = await render(TRIP, [request('accepted')]);

    expect(root.querySelector('.driver-trip__call-btn')?.classList).toContain(
      'driver-trip__call-btn--unavailable',
    );
    fixture.componentInstance.handleCallPassenger({ id: 'p1', name: 'Mario Pérez' });
    expect(toast['showInfo']).toHaveBeenCalledWith(
      'Solo se puede llamar con el viaje confirmado o en curso.',
    );
  });
});
