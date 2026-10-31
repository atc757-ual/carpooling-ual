import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { PassengerRequests } from './passenger-requests';
import { ConfirmService } from '../../../core/services/ui/confirm.service';

function trip(id: string, status: Trip['status']): Trip {
  return {
    id,
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 1,
    maxDetourMin: 10,
    status,
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
    driver: { id: 'd1', name: 'Lucía Cortés' },
  };
}

function request(id: string, tripId: string, status: SeatRequest['status']): SeatRequest {
  return {
    id,
    trip: { id: tripId },
    passenger: { id: 'p1', name: 'Mario Pérez' },
    status,
    isPriority: false,
    seats: 2,
    requestedAt: '2099-01-14T10:00:00.000Z',
    answeredAt: null,
    cancelledAt: null,
    vehiclePlate: status === 'accepted' ? '1234BCD' : null,
  };
}

describe('PassengerRequests', () => {
  let fixture: ComponentFixture<PassengerRequests>;
  let requests: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;

  async function render(mine: SeatRequest[], trips: Trip[]): Promise<HTMLElement> {
    requests = {
      listMine: vi.fn().mockResolvedValue(mine),
      cancel: vi.fn().mockResolvedValue({}),
    };
    showError = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [PassengerRequests],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: SeatRequestsService, useValue: requests },
        {
          provide: TripsService,
          useValue: {
            getTrip: vi.fn((id: string) => Promise.resolve(trips.find((item) => item.id === id))),
          },
        },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    fixture = TestBed.createComponent(PassengerRequests);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function confirmWith(role: string): void {
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(role === 'destructive');
  }

  it('shows each request with its trip, upcoming first', async () => {
    const root = await render(
      [request('r1', 't1', 'accepted'), request('r2', 't2', 'pending')],
      [trip('t1', 'confirmed'), trip('t2', 'finished')],
    );

    expect(fixture.componentInstance.upcoming().map(({ request }) => request.id)).toEqual(['r1']);
    expect(fixture.componentInstance.past().map(({ request }) => request.id)).toEqual(['r2']);
    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL · Parking P1 (Sur)');
    expect(root.textContent).toContain('Conduce Lucía Cortés · 2 plazas · Matrícula 1234BCD');
    expect(root.textContent).toContain('Confirmada');
  });

  it('lets cancel only active requests of trips that have not started', async () => {
    await render(
      [request('r1', 't1', 'pending'), request('r2', 't2', 'accepted')],
      [trip('t1', 'published'), trip('t2', 'in_progress')],
    );
    const [first, second] = fixture.componentInstance.upcoming();

    expect(fixture.componentInstance['canCancel'](first)).toBe(true);
    expect(fixture.componentInstance['canCancel'](second)).toBe(false);
  });

  it('cancels after confirming it and reloads', async () => {
    await render([request('r1', 't1', 'pending')], [trip('t1', 'published')]);
    const [item] = fixture.componentInstance.upcoming();

    confirmWith('cancel');
    await fixture.componentInstance.handleCancel(item);
    expect(requests['cancel']).not.toHaveBeenCalled();

    confirmWith('destructive');
    await fixture.componentInstance.handleCancel(item);
    await fixture.whenStable();
    expect(requests['cancel']).toHaveBeenCalledWith('r1');
    expect(requests['listMine']).toHaveBeenCalledTimes(2);
  });

  it('shows the API error when it cannot cancel', async () => {
    await render([request('r1', 't1', 'pending')], [trip('t1', 'published')]);
    requests['cancel'].mockRejectedValue(new Error('down'));
    confirmWith('destructive');

    await fixture.componentInstance.handleCancel(fixture.componentInstance.upcoming()[0]);

    expect(showError).toHaveBeenCalled();
    expect(fixture.componentInstance.cancelling()).toBeNull();
  });

  it('invites to search when there are no requests', async () => {
    const root = await render([], []);

    expect(root.textContent).toContain('Aún no has pedido plaza en ningún viaje');
  });

  it('offers to retry when they cannot be loaded', async () => {
    requests = { listMine: vi.fn(), cancel: vi.fn() };
    const root = await render([], []);
    requests['listMine'].mockRejectedValue(new Error('down'));
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();

    expect(root.textContent).toContain('No hemos podido cargar tus solicitudes');
  });
});
