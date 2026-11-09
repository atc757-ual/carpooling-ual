import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { PassengerRequests } from './passenger-requests';

function trip(id: string, status: Trip['status']): Trip {
  return {
    id,
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 1,
    maxDetourMin: 10,
    vehicleId: 'v1',
    status,
    origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
    destination: { type: 'Point', coordinates: [-2.4, 36.83] },
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
    vehicle: null,
    driver: {
      id: 'd1',
      name: 'Lucía Cortés',
      avatarKey: null,
      preferences: { conversation: null, music: null, smoking: null, pets: null },
      tripCount: 0,
      rating: null,
    },
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

  async function render(mine: SeatRequest[], trips: Trip[]): Promise<HTMLElement> {
    requests = { listMine: vi.fn().mockResolvedValue(mine) };
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
      ],
    });
    fixture = TestBed.createComponent(PassengerRequests);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the requests of the tab, each with its trip', async () => {
    const root = await render(
      [
        request('r1', 't1', 'accepted'),
        request('r2', 't2', 'accepted'),
        { ...request('r3', 't3', 'cancelled'), rejectionReason: 'no_show' },
      ],
      [trip('t1', 'confirmed'), trip('t2', 'finished'), trip('t3', 'finished')],
    );
    const ids = (): string[] =>
      fixture.componentInstance.tabItems().map(({ request }) => request.id);

    expect(ids()).toEqual(['r1']);
    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL · Parking P1 (Sur)');
    expect(root.textContent).toContain('Conduce Lucía Cortés · 2 plazas · Matrícula 1234BCD');
    expect(root.textContent).toContain('Confirmada');

    fixture.componentRef.setInput('tab', 'past');
    fixture.detectChanges();
    expect(ids()).toEqual(['r2']);
    expect(root.textContent).toContain('Realizado');

    fixture.componentRef.setInput('tab', 'cancelled');
    fixture.detectChanges();
    expect(ids()).toEqual(['r3']);
    expect(root.textContent).toContain('No te presentaste');
  });

  it('keeps the trip in progress out of the upcoming list', async () => {
    await render(
      [request('r1', 't1', 'pending'), request('r2', 't2', 'accepted')],
      [trip('t1', 'published'), trip('t2', 'in_progress')],
    );

    expect(fixture.componentInstance.tabItems()).toHaveLength(1);
    expect(fixture.componentInstance.live()?.request.id).toBe('r2');
    expect(fixture.componentInstance.upcomingCount()).toBe(1);
  });

  it('links each card to its request and leaves cancelling to the detail', async () => {
    const root = await render([request('r1', 't1', 'pending')], [trip('t1', 'published')]);
    const link = root.querySelector('.passenger-request__link');

    expect(link?.getAttribute('href')).toBe('/tabs/trips/requests/r1');
    expect(link?.getAttribute('aria-label')).toContain('Ver solicitud:');
    expect(link?.getAttribute('aria-label')).toContain('Pendiente');
    expect(root.textContent).not.toContain('Cancelar solicitud');
  });

  it('says who the passenger is waiting for', async () => {
    const root = await render([request('r1', 't1', 'pending')], [trip('t1', 'published')]);

    expect(root.querySelector('.passenger-request__next')?.textContent).toBe(
      'Esperando respuesta de Lucía',
    );
  });

  it('gives the pickup time of a confirmed seat', async () => {
    const root = await render(
      [{ ...request('r1', 't1', 'accepted'), pickupAt: '2099-01-15T06:50:00.000Z' }],
      [trip('t1', 'confirmed')],
    );

    expect(root.querySelector('.passenger-request__next')?.textContent).toContain(
      'Confirmada: te recoge a las',
    );
  });

  it('names the driver when a confirmed seat has no pickup time', async () => {
    const root = await render([request('r1', 't1', 'accepted')], [trip('t1', 'confirmed')]);

    expect(root.querySelector('.passenger-request__next')?.textContent).toBe(
      'Confirmada: viajas con Lucía',
    );
  });

  it('has no next step once the trip is over', async () => {
    const root = await render([request('r1', 't1', 'accepted')], [trip('t1', 'finished')]);

    fixture.componentRef.setInput('tab', 'past');
    fixture.detectChanges();

    expect(root.querySelector('.passenger-request')).not.toBeNull();
    expect(root.querySelector('.passenger-request__next')).toBeNull();
  });

  it('groups the requests by day, keeping their order', async () => {
    const root = await render(
      [
        request('r1', 't1', 'pending'),
        request('r2', 't2', 'pending'),
        request('r3', 't3', 'pending'),
      ],
      [
        { ...trip('t1', 'published'), departureAt: '2099-01-16T12:00:00.000Z' },
        { ...trip('t2', 'published'), departureAt: '2099-01-15T12:00:00.000Z' },
        { ...trip('t3', 'published'), departureAt: '2099-01-15T13:00:00.000Z' },
      ],
    );
    const groups = fixture.componentInstance.dayGroups();

    expect(groups.map(({ items }) => items.map((item) => item.request.id))).toEqual([
      ['r2', 'r3'],
      ['r1'],
    ]);
    expect(root.querySelectorAll('.passenger-requests__day')).toHaveLength(2);
  });

  it('explains the empty tab of the trips not made', async () => {
    const root = await render([], []);

    fixture.componentRef.setInput('tab', 'cancelled');
    fixture.detectChanges();

    expect(root.textContent).toContain('Aquí verás los viajes que no se hayan realizado');
  });

  it('invites to search when there are no upcoming requests', async () => {
    const root = await render([], []);

    expect(root.textContent).toContain('No tienes viajes programados');
    expect(root.textContent).toContain('Buscar viaje');
  });

  it('offers to retry when they cannot be loaded', async () => {
    const root = await render([], []);
    requests['listMine'].mockRejectedValue(new Error('down'));
    fixture.componentInstance.handleRetry();
    await fixture.whenStable();

    expect(root.textContent).toContain('No hemos podido cargar tus solicitudes');
  });
});
