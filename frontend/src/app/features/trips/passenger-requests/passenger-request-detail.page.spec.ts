import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { TripPosition } from '../../../core/models/trip-position.model';
import { LocationService } from '../../../core/services/location/location.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { TripSearchStateService } from '../../matching/trip-search-state.service';
import {
  LIVE_TRIP_MAP_RENDERER_FACTORY,
  LOAD_LEAFLET,
} from './live-trip-map/live-trip-map-runtime';
import { PassengerRequestDetailPage } from './passenger-request-detail.page';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';

const TRIP: Trip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 2,
  maxDetourMin: 10,
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

const LIVE_POSITION: TripPosition = {
  tripId: 't1',
  position: { type: 'Point', coordinates: [-2.46, 36.84] },
  recordedAt: '2099-01-15T06:40:00.000Z',
  remainingKm: 1,
  remainingMin: 2,
  remainingSource: 'estimated',
  estimatedArrivalAt: '2099-01-15T06:42:00.000Z',
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
  let listContactsMock: ReturnType<typeof vi.fn>;
  let modalDismiss: ReturnType<typeof vi.fn>;

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
    listContactsMock = vi
      .fn()
      .mockResolvedValue([
        { id: 'd1', name: 'Lucía Cortés', phone: '+34600111222', role: 'driver' },
      ]);
    modalDismiss = vi.fn().mockResolvedValue(true);

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
          },
        },
        { provide: AvatarsService, useValue: { getGraphic: () => Promise.resolve(null) } },
        {
          provide: TrackingService,
          useValue: { getLatest: vi.fn().mockResolvedValue(LIVE_POSITION) },
        },
        {
          provide: LocationService,
          useValue: {
            checkPermission: vi.fn().mockResolvedValue('prompt'),
            getCurrentLocation: vi.fn(),
          },
        },
        { provide: LOAD_LEAFLET, useValue: vi.fn().mockResolvedValue({}) },
        {
          provide: LIVE_TRIP_MAP_RENDERER_FACTORY,
          useValue: () => ({
            initialize: vi.fn(),
            render: vi.fn(),
            center: vi.fn(),
            destroy: vi.fn(),
          }),
        },
        { provide: ToastService, useValue: { showError, showSuccess, showInfo } },
        { provide: ChatService, useValue: { listContacts: listContactsMock } },
        {
          provide: ModalController,
          useValue: {
            create: vi.fn().mockResolvedValue({
              present: vi.fn().mockResolvedValue(undefined),
              onWillDismiss: vi.fn().mockResolvedValue({ data: { reported: true } }),
            }),
            dismiss: modalDismiss,
          },
        },
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
    expect(root.querySelector('app-trip-chat-link')).toBeNull();
    expect(root.textContent).toContain('12 viajes');
    expect(root.textContent).toContain('★ 4,8');
    expect(root.textContent).toContain('Seat Ibiza');
    expect(root.textContent).toContain('Música suave');
    expect(root.textContent).not.toContain('1234BCD');
    expect(root.querySelectorAll('.route-timeline__stop')).toHaveLength(3);
    expect(root.textContent).toContain('Solicitud enviada');
    expect(root.textContent).toContain('Cancelar solicitud');
  });

  it('shows acceptance history, progress indicator and plate after acceptance', async () => {
    const root = await render(seatRequest('accepted', { answeredAt: '2099-01-14T21:30:00.000Z' }), {
      ...TRIP,
      status: 'confirmed',
    });

    expect(root.textContent).toContain('Tienes plaza en el coche de Lucía.');
    expect(root.textContent).toContain('Solicitud aceptada');
    expect(root.textContent).toContain('1234BCD');
    expect(root.querySelector('app-trip-progress')).not.toBeNull();
    expect(root.textContent).toContain('Cancelar mi plaza');
    expect(root.querySelector('app-trip-chat-link')?.textContent).toContain('Chat del viaje');
  });

  it('shows live map and incident button for an accepted request when trip is in progress', async () => {
    const root = await render(seatRequest('accepted'), { ...TRIP, status: 'in_progress' });

    expect(root.querySelector('app-live-trip-map')).not.toBeNull();
    expect(root.textContent).toContain('Seguimiento en tiempo real');
    expect(root.textContent).toContain('Bajarme y registrar incidencia');
  });

  it('opens incident modal when incident button is clicked', async () => {
    await render(seatRequest('accepted'), { ...TRIP, status: 'in_progress' });
    const modalCtrl = TestBed.inject(ModalController);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await fixture.componentInstance.openIncidentModal();

    expect(modalCtrl.create).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith('Incidencia registrada. Tu plaza ha sido cancelada.');
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/trips');
  });

  it('offers search with priority after rejection and sets search state', async () => {
    const root = await render(seatRequest('rejected', { answeredAt: '2099-01-14T21:30:00.000Z' }));

    expect(root.textContent).toContain('Lucía no pudo aceptar tu solicitud.');
    expect(root.textContent).toContain('Esta vez no ha podido ser');
    expect(root.textContent).toContain('Buscar con prioridad');

    const searchState = TestBed.inject(TripSearchStateService);
    const setSpy = vi.spyOn(searchState, 'set');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.componentInstance.handlePrioritySearch();

    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'to-campus',
        seats: 1,
      }),
    );
    expect(navigateSpy).toHaveBeenCalledWith('/tabs/search');
  });

  it('cancels an accepted request before departure with confirmation', async () => {
    await render(seatRequest('accepted'), { ...TRIP, status: 'confirmed' });
    const ask = vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(true);

    await fixture.componentInstance.handleCancel();

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        header: '¿Cancelar tu plaza confirmada?',
        confirmText: 'Cancelar mi plaza',
      }),
    );
    expect(requests['cancel']).toHaveBeenCalledWith('r1');
    expect(showSuccess).toHaveBeenCalledWith('Plaza cancelada.');
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

  it('shows call button for accepted request and calls driver when trip is confirmed', async () => {
    const root = await render(seatRequest('accepted'), { ...TRIP, status: 'confirmed' });
    const tripCall = TestBed.inject(TripCallService);
    const openPhoneSpy = vi.spyOn(tripCall, 'openPhone').mockImplementation(() => undefined);

    const callBtn = root.querySelector('.passenger-request-detail__call-btn');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.textContent).toContain('Llamar a Lucía');
    expect(callBtn?.classList).not.toContain('passenger-request-detail__call-btn--unavailable');

    fixture.componentInstance.handleCallDriver();
    expect(openPhoneSpy).toHaveBeenCalledWith('+34600111222');
  });

  it('shows call button as unavailable and shows info toast when trip is published or driver has no verified phone', async () => {
    const root = await render(seatRequest('accepted'), { ...TRIP, status: 'published' });

    const callBtn = root.querySelector('.passenger-request-detail__call-btn');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.classList).toContain('passenger-request-detail__call-btn--unavailable');

    fixture.componentInstance.handleCallDriver();
    expect(showInfo).toHaveBeenCalledWith(
      'Solo se puede llamar con el viaje confirmado o en curso.',
    );
  });
});
