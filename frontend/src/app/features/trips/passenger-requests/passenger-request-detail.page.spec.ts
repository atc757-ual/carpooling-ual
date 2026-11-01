import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { PassengerRequestDetailPage } from './passenger-request-detail.page';

const TRIP: Trip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 2,
  maxDetourMin: 10,
  status: 'published',
  origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
  destination: { type: 'Point', coordinates: [-2.4, 36.83] },
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
  vehicle: { brand: 'Seat', model: 'Ibiza', color: 'blue' },
  driver: {
    id: 'd1',
    name: 'Lucía Cortés',
    avatarKey: 'sun',
    preferences: { conversation: 'quiet', music: 'soft', smoking: 'no', pets: null },
    tripCount: 12,
    rating: 4.8,
  },
};

function seatRequest(
  status: SeatRequest['status'],
  changes: Partial<SeatRequest> = {},
): SeatRequest {
  return {
    id: 'r1',
    trip: { id: 't1' },
    passenger: { id: 'p1', name: 'Mario Pérez' },
    status,
    isPriority: false,
    seats: 1,
    direction: 'to-campus',
    pickupLocation: { type: 'Point', coordinates: [-2.46, 36.84] },
    pickupName: 'Calle Profesor Mulián, 29',
    pickupAt: '2099-01-15T06:52:00.000Z',
    requestedAt: '2099-01-14T21:04:00.000Z',
    answeredAt: null,
    cancelledAt: null,
    vehiclePlate: status === 'accepted' ? '1234BCD' : null,
    ...changes,
  };
}

describe('PassengerRequestDetailPage', () => {
  let fixture: ComponentFixture<PassengerRequestDetailPage>;
  let requests: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;

  async function render(
    request: SeatRequest | null = seatRequest('pending'),
    trip: Trip | Error = TRIP,
  ): Promise<HTMLElement> {
    requests = {
      listMine: vi.fn().mockResolvedValue(request ? [request] : []),
      cancel: vi
        .fn()
        .mockResolvedValue(seatRequest('cancelled', { cancelledAt: '2099-01-14T21:10:00.000Z' })),
    };
    showError = vi.fn().mockResolvedValue(undefined);
    showSuccess = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [PassengerRequestDetailPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: SeatRequestsService, useValue: requests },
        {
          provide: TripsService,
          useValue: {
            getTrip: vi
              .fn()
              .mockImplementation(() =>
                trip instanceof Error ? Promise.reject(trip) : Promise.resolve(trip),
              ),
          },
        },
        { provide: AvatarsService, useValue: { getGraphic: () => Promise.resolve(null) } },
        { provide: ToastService, useValue: { showError, showSuccess } },
      ],
    });
    fixture = TestBed.createComponent(PassengerRequestDetailPage);
    fixture.componentRef.setInput('id', 'r1');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows pending status, pickup timeline, driver, car, preferences and history', async () => {
    const root = await render();

    expect(root.textContent).toContain('Tu solicitud está en manos de Lucía.');
    expect(root.textContent).toContain('Ida al campus');
    expect(root.textContent).toContain('Calle Profesor Mulián, 29');
    expect(root.textContent).toContain('Has pedido 1 plaza.');
    expect(root.textContent).toContain('Una solicitud pendiente no ocupa plaza');
    expect(root.textContent).toContain('12 viajes');
    expect(root.textContent).toContain('★ 4,8');
    expect(root.textContent).toContain('Seat Ibiza');
    expect(root.textContent).toContain('Música suave');
    expect(root.textContent).not.toContain('1234BCD');
    expect(root.querySelectorAll('.route-timeline__stop')).toHaveLength(3);
    expect(root.textContent).toContain('Solicitud enviada');
    expect(root.textContent).toContain('Cancelar solicitud');
  });

  it('shows acceptance history and the plate only after acceptance', async () => {
    const root = await render(seatRequest('accepted', { answeredAt: '2099-01-14T21:30:00.000Z' }));

    expect(root.textContent).toContain('Tienes plaza en el coche de Lucía.');
    expect(root.textContent).toContain('Solicitud aceptada');
    expect(root.textContent).toContain('1234BCD');
    expect(root.textContent).not.toContain('Cancelar solicitud');
  });

  it('offers another search after rejection', async () => {
    const root = await render(seatRequest('rejected', { answeredAt: '2099-01-14T21:30:00.000Z' }));

    expect(root.textContent).toContain('Lucía no pudo aceptar tu solicitud.');
    expect(root.textContent).toContain('Buscar otro viaje');
    expect(root.textContent).toContain('Solicitud respondida');
  });

  it('cancels a pending request only after confirmation and reports success', async () => {
    await render();
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);

    await fixture.componentInstance.handleCancel();
    expect(requests['cancel']).not.toHaveBeenCalled();

    ask.mockResolvedValue(true);
    await fixture.componentInstance.handleCancel();
    fixture.detectChanges();

    expect(ask).toHaveBeenLastCalledWith({
      header: '¿Cancelar la solicitud?',
      message: 'Lucía dejará de verla. Puedes volver a solicitar si sigue habiendo plazas.',
      confirmText: 'Cancelar solicitud',
      cancelText: 'Mantener',
      isDestructive: true,
    });
    expect(requests['cancel']).toHaveBeenCalledWith('r1');
    expect(showSuccess).toHaveBeenCalledWith('Solicitud cancelada.');
    expect(fixture.componentInstance.request()?.status).toBe('cancelled');
  });

  it('shows the missing request state when it is not mine', async () => {
    const root = await render(null);

    expect(root.textContent).toContain('No encontramos esta solicitud');
    expect(requests['listMine']).toHaveBeenCalled();
  });

  it('shows a retry destination when trip details cannot be loaded', async () => {
    const root = await render(seatRequest('pending'), new Error('unavailable'));

    expect(root.textContent).toContain('No pudimos cargar el viaje');
    expect(root.textContent).toContain('Volver a Tus viajes');
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows an API error when cancellation fails', async () => {
    await render();
    requests['cancel'].mockRejectedValue(new Error('down'));
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);

    await fixture.componentInstance.handleCancel();

    expect(showError).toHaveBeenCalled();
    expect(fixture.componentInstance.isCancelling()).toBe(false);
  });
});
