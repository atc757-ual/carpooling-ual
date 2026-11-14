import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { ChatService } from '../../../core/services/chat/chat.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import { TripSearchStateService } from '../../matching/trip-search-state.service';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { PassengerRequestActions } from './passenger-request-actions/passenger-request-actions';
import { PassengerRequestDetailPage } from './passenger-request-detail.page';
import { PassengerRequestRoute } from './passenger-request-route/passenger-request-route';

const TRIP: Trip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 2,
  maxDetourMin: 10,
  pickupMode: 'on_route',
  maxDetourM: 500,
  stops: [],
  vehicleId: 'v1',
  status: 'published',
  origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
  destination: { type: 'Point', coordinates: [-2.4, 36.83] },
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
  isLocationApproximate: false,
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
  let showInfo: ReturnType<typeof vi.fn>;

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
    showInfo = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [PassengerRequestDetailPage],
      providers: [
        provideCatalogsForTests(),
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
            // Sin ruta: el mapa no se pinta (Leaflet no está en las pruebas)
            getRoute: vi.fn().mockRejectedValue(new Error('no route')),
          },
        },
        { provide: AvatarsService, useValue: { getGraphic: () => Promise.resolve(null) } },
        { provide: ToastService, useValue: { showError, showSuccess, showInfo } },
        {
          provide: ChatService,
          useValue: {
            listContacts: vi
              .fn()
              .mockResolvedValue([
                { id: 'd1', name: 'Lucía Cortés', phone: '+34600111222', role: 'driver' },
              ]),
          },
        },
        {
          provide: TripReviewsService,
          useValue: {
            listGiven: vi.fn().mockResolvedValue([]),
            listPending: vi
              .fn()
              .mockResolvedValue([{ trip: { id: 't1' }, targets: [{ id: 'd1' }] }]),
          },
        },
        {
          provide: ModalController,
          useValue: {
            create: vi.fn().mockResolvedValue({
              present: vi.fn().mockResolvedValue(undefined),
              onWillDismiss: vi.fn().mockResolvedValue({ data: { reported: true } }),
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PassengerRequestDetailPage);
    fixture.componentRef.setInput('id', 'r1');
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const actions = () =>
    fixture.debugElement.query(By.directive(PassengerRequestActions))
      .componentInstance as PassengerRequestActions;
  const route = () =>
    fixture.debugElement.query(By.directive(PassengerRequestRoute))
      .componentInstance as PassengerRequestRoute;

  it('shows a pending request: who decides, its progress, the route and the cost of cancelling', async () => {
    const root = await render();

    expect(root.textContent).toContain('Tu solicitud está en manos de Lucía.');
    expect(root.querySelector('app-passenger-progress')?.textContent).toContain('Solicitada');
    expect(root.textContent).toContain('Calle Profesor Mulián, 29');
    expect(root.textContent).toContain('Seat Ibiza');
    expect(root.textContent).not.toContain('1234BCD');
    // Sin hora de recogida hasta decidir el cálculo con varios pasajeros
    expect(root.textContent).not.toContain('Hora de recogida');
    expect(root.textContent).toContain('Puedes cancelarla sin coste.');
    expect(root.textContent).toContain('Cancelar solicitud');
    expect(root.querySelector('app-trip-chat-link')).toBeNull();
  });

  it('shows an accepted request with the plate, the chat and the code from 10 min before', async () => {
    const root = await render(seatRequest('accepted', { answeredAt: '2099-01-14T21:30:00.000Z' }), {
      ...TRIP,
      status: 'confirmed',
    });

    expect(root.textContent).toContain('Tienes plaza en el coche de Lucía.');
    expect(root.textContent).toContain('1234BCD');
    expect(root.textContent).toContain('Cancelar mi plaza');
    expect(root.querySelector('app-trip-chat-link')?.textContent).toContain(
      'Chat con el conductor',
    );
    expect(root.textContent).toContain('Verás el código 10 minutos antes de la salida');
  });

  it('sends a started trip to its live screen instead of showing the map here', async () => {
    const root = await render(seatRequest('accepted'), { ...TRIP, status: 'in_progress' });

    expect(root.querySelector('app-live-trip-map')).toBeNull();
    expect(root.textContent).toContain('Lucía ha empezado el viaje.');
    expect(root.textContent).toContain('Seguir en directo');
    expect(root.textContent).toContain('Bajarme y registrar incidencia');
  });

  it('opens the incident window and goes back to Tus viajes once reported', async () => {
    await render(seatRequest('accepted'), { ...TRIP, status: 'in_progress' });
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await actions().openIncidentModal();

    expect(TestBed.inject(ModalController).create).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith('Incidencia registrada. Tu plaza ha sido cancelada.');
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/trips');
  });

  it('offers a priority search after a rejection, keeping the route and the time', async () => {
    const root = await render(seatRequest('rejected', { answeredAt: '2099-01-14T21:30:00.000Z' }));

    expect(root.textContent).toContain('Lucía no pudo aceptar tu solicitud.');
    expect(root.textContent).toContain('Buscar con prioridad');
    const setSpy = vi.spyOn(TestBed.inject(TripSearchStateService), 'set');
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    actions().handlePrioritySearch();

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'to-campus', seats: 1 }),
    );
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/search');
  });

  it('cancels an accepted seat after confirming it', async () => {
    await render(seatRequest('accepted'), { ...TRIP, status: 'confirmed' });
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);

    await actions().handleCancel();

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        header: '¿Cancelar tu plaza confirmada?',
        confirmText: 'Cancelar mi plaza',
      }),
    );
    expect(requests['cancel']).toHaveBeenCalledWith('r1');
    expect(showSuccess).toHaveBeenCalledWith('Plaza cancelada.');
  });

  it('cancels a pending request only after confirming it and shows it cancelled', async () => {
    await render();
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(false);

    await actions().handleCancel();
    expect(requests['cancel']).not.toHaveBeenCalled();

    ask.mockResolvedValue(true);
    await actions().handleCancel();
    fixture.detectChanges();

    expect(ask).toHaveBeenLastCalledWith({
      header: '¿Cancelar la solicitud?',
      message: 'Lucía dejará de verla. Puedes volver a solicitar si sigue habiendo plazas.',
      confirmText: 'Cancelar solicitud',
      cancelText: 'Mantener',
      isDestructive: true,
    });
    expect(showSuccess).toHaveBeenCalledWith('Solicitud cancelada.');
    expect(fixture.componentInstance.request()?.status).toBe('cancelled');
  });

  it('says it when the request is not mine or the trip cannot be loaded', async () => {
    const root = await render(null);
    expect(root.textContent).toContain('No encontramos esta solicitud');

    TestBed.resetTestingModule();
    const other = await render(seatRequest('pending'), new Error('unavailable'));
    expect(other.textContent).toContain('No pudimos cargar el viaje');
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows the error when cancelling fails', async () => {
    await render();
    requests['cancel'].mockRejectedValue(new Error('down'));
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);

    await actions().handleCancel();

    expect(showError).toHaveBeenCalled();
    expect(actions().isCancelling()).toBe(false);
  });

  it('calls the driver with a confirmed trip, and explains why not before', async () => {
    await render(seatRequest('accepted'), { ...TRIP, status: 'confirmed' });
    const openPhone = vi
      .spyOn(TestBed.inject(TripCallService), 'openPhone')
      .mockImplementation(() => undefined);

    route().handleCallDriver();
    expect(openPhone).toHaveBeenCalledWith('+34600111222');

    TestBed.resetTestingModule();
    await render(seatRequest('accepted'), { ...TRIP, status: 'published' });
    route().handleCallDriver();
    expect(showInfo).toHaveBeenCalledWith(
      'Solo se puede llamar con el viaje confirmado o en curso.',
    );
  });

  it('stops offering to cancel once the pending request expires (refreshed on enter)', async () => {
    const root = await render(seatRequest('pending'));
    expect(root.textContent).toContain('Cancelar solicitud');

    requests['listMine'].mockResolvedValue([seatRequest('expired')]);
    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    fixture.detectChanges();

    // El botón sigue, desactivado y con su motivo
    expect(actions().canCancel()).toBe(false);
    expect(root.textContent).toContain('Esta solicitud caducó antes de la salida.');
    expect(root.textContent).toContain('las solicitudes se cierran 10 minutos antes de la salida');
  });

  it('checks a pending request every 30 s while it is on screen', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    try {
      await render(seatRequest('pending'));
      // El último de 30 s (el primero es el reloj del código de recogida)
      const refresh = setIntervalSpy.mock.calls.filter(([, delay]) => delay === 30_000).at(-1)?.[0];
      const calls = requests['listMine'].mock.calls.length;

      (refresh as () => void)();
      await fixture.whenStable();

      expect(requests['listMine'].mock.calls).toHaveLength(calls + 1);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  it('says it in the past and lets the passenger review the driver once the trip ended', async () => {
    const root = await render(seatRequest('accepted'), { ...TRIP, status: 'finished' });

    expect(fixture.componentInstance.statusLabel()).toBeTruthy();
    expect(root.querySelector('app-trip-review-card')?.textContent).toContain(
      '¿Qué tal con Lucía?',
    );
  });
});
