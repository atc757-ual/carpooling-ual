import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { ChatService } from '../../../core/services/chat/chat.service';
import { LocationService } from '../../../core/services/location/location.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { GivenReview, TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import {
  LIVE_TRIP_MAP_RENDERER_FACTORY,
  LOAD_LEAFLET,
} from '../passenger-requests/live-trip-map/live-trip-map-runtime';
import { DESKTOP_MEDIA_QUERY } from '../../../shared/utils/desktop-query.util';
import { PassengerLiveTripPage, ridePhase } from './passenger-live-trip.page';

const TRIP = {
  id: 't1',
  status: 'in_progress',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 2,
  origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
  destination: { type: 'Point', coordinates: [-2.4, 36.83] },
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
  vehicle: { brand: 'Seat', model: 'Ibiza', color: 'blue' },
  driver: { id: 'd1', name: 'Lucía Cortés', avatarKey: null, tripCount: 3, rating: null },
} as unknown as Trip;

const request = (changes: Partial<SeatRequest> = {}): SeatRequest =>
  ({
    id: 'r1',
    trip: { id: 't1' },
    status: 'accepted',
    direction: 'to-campus',
    seats: 1,
    pickupName: 'Calle Profesor Mulian, 29',
    pickupLocation: { type: 'Point', coordinates: [-2.46, 36.84] },
    boardCode: '7192',
    boardedAt: null,
    vehiclePlate: '1269GFD',
    ...changes,
  }) as SeatRequest;

const RENDERER = {
  initialize: vi.fn(),
  render: vi.fn(),
  center: vi.fn(),
  setBottomInset: vi.fn(),
  setCarTitle: vi.fn(),
  destroy: vi.fn(),
};

describe('PassengerLiveTripPage', () => {
  let page: PassengerLiveTripPage;
  let root: HTMLElement;
  let showSuccess: ReturnType<typeof vi.fn>;
  // La ventana del formulario de la incidencia (escritorio): se envía
  const createModal = vi.fn().mockResolvedValue({
    present: () => Promise.resolve(),
    onWillDismiss: () => Promise.resolve({ data: { reported: true } }),
  });
  let showError: ReturnType<typeof vi.fn>;
  let arrive: ReturnType<typeof vi.fn>;
  let getTrip: ReturnType<typeof vi.fn>;

  async function render(req: SeatRequest = request(), trip: Trip = TRIP): Promise<void> {
    showSuccess = vi.fn();
    showError = vi.fn();
    arrive = vi.fn();
    getTrip = vi.fn().mockResolvedValue(trip);
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideRouter([]),
        provideCatalogsForTests(),
        {
          provide: SeatRequestsService,
          useValue: { getMine: vi.fn().mockResolvedValue(req), arrive },
        },
        { provide: TripsService, useValue: { getTrip } },
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
          provide: ToastService,
          useValue: { showSuccess, showError, showInfo: vi.fn() },
        },
        {
          provide: TrackingService,
          useValue: { getLatest: vi.fn().mockRejectedValue(new Error()) },
        },
        { provide: LocationService, useValue: { checkPermission: vi.fn() } },
        { provide: LOAD_LEAFLET, useValue: vi.fn().mockResolvedValue({}) },
        { provide: LIVE_TRIP_MAP_RENDERER_FACTORY, useValue: () => RENDERER },
        {
          provide: TripReviewsService,
          useValue: { create: vi.fn().mockResolvedValue({ id: 'rev1' }) },
        },
        { provide: ModalController, useValue: { create: createModal } },
      ],
    });
    const fixture = TestBed.createComponent(PassengerLiveTripPage);
    fixture.componentRef.setInput('id', 'r1');
    await fixture.whenStable();
    fixture.detectChanges();
    page = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
  }

  it('waits for the driver: the code, the car to look for and the minutes in live', async () => {
    await render();

    expect(page.phase()).toBe('waiting');
    expect(page.heroTitle()).toBe('Esperando a Lucía');
    expect(root.querySelectorAll('.ride__code-digits span[aria-hidden="true"]')).toHaveLength(4);
    // El lector, los dígitos uno a uno (texto oculto: un div no admite aria-label)
    expect(root.querySelector('.ride__code-digits .visually-hidden')?.textContent).toMatch(
      /^\d( \d){3}$/,
    );
    expect(root.querySelector('.ride__code-digits')?.hasAttribute('aria-label')).toBe(false);
    expect(root.textContent).toContain('Conduce');
    expect(root.textContent).toContain('Seat Ibiza');
    // En curso, el nombre sin abrir el perfil (sería una ventana sobre la hoja)
    // y, debajo, su correo
    expect(root.querySelector('.ride__driver-name app-participant-link')).toBeNull();
    expect(root.querySelector('app-participant-email')).not.toBeNull();
    expect(page.stages()[0].state).toBe('current');

    page.liveStatus.set({
      pickupMinutes: 3,
      destinationMinutes: 12,
      destinationMeters: 4000,
      isTogether: false,
      isStale: false,
    });
    expect(page.etaText()).toBe('Llega en 3 min');
    page.liveStatus.update((status) => (status ? { ...status, isStale: true } : status));
    expect(page.etaText()).toBe('Sin posición');
  });

  it('heads to the campus once on board, and is arriving within 300 m', async () => {
    await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }));

    expect(page.heroTitle()).toBe('Rumbo al campus');
    page.liveStatus.set({
      pickupMinutes: null,
      destinationMinutes: 1,
      destinationMeters: 200,
      isTogether: true,
      isStale: false,
    });
    expect(page.heroTitle()).toBe('Llegando al campus');
    expect(page.stages()[2].state).toBe('current');
    expect(page.etaText()).toBe('Llegando');
  });

  it('heads home on the way back, without the arriving stage', async () => {
    await render(
      request({
        boardedAt: '2099-01-15T06:45:00.000Z',
        direction: 'from-campus',
        pickupLocation: null,
      }),
    );

    expect(page.heroTitle()).toBe('Rumbo a casa');
    expect(page.pickupLocation()).toEqual(TRIP.origin);
  });

  it('says it has arrived and lets the passenger review the driver', async () => {
    await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }), {
      ...TRIP,
      status: 'finished',
    });

    expect(page.phase()).toBe('finished');
    expect(root.textContent).toContain('Tu viaje ha terminado');
    expect(root.querySelector('app-trip-review-form')).not.toBeNull();
  });

  it('cannot be followed before the trip starts', async () => {
    await render(request(), { ...TRIP, status: 'confirmed' });

    expect(page.isLive()).toBe(false);
    expect(root.textContent).toContain('Este viaje no está en curso');
  });

  it('on desktop reports an incident in a dialog and goes back to Tus viajes', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleReport();
    expect(createModal).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { tripId: TRIP.id, isDriver: false } }),
    );
    expect(page.isReportingIncident()).toBe(false);
    expect(showSuccess).toHaveBeenCalledWith('Incidencia registrada. Tu plaza ha sido cancelada.');
    expect(navigate).toHaveBeenCalledWith('/tabs/trips');
  });

  it('calls the driver', async () => {
    await render();
    await TestBed.inject(TripCallService).loadContacts('t1');
    const openPhone = vi
      .spyOn(TestBed.inject(TripCallService), 'openPhone')
      .mockImplementation(() => undefined);

    page.handleCallDriver();

    expect(page.callDriverLabel()).toContain('Lucía');
    expect(openPhone).toHaveBeenCalledWith('+34600111222');
  });

  it('asks before «He llegado» and then closes the seat', async () => {
    const onBoard = request({ boardedAt: '2099-01-15T06:45:00.000Z' });
    await render(onBoard);
    const event = new Event('click');
    const preventDefault = vi.spyOn(event, 'preventDefault');
    arrive.mockResolvedValue({ ...onBoard, status: 'completed' });

    page.handleArrive(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(page.pendingConfirm()).toEqual({ kind: 'arrive' });

    await page.handleConfirmPending();
    expect(arrive).toHaveBeenCalledWith('r1');
    expect(page.request()?.status).toBe('completed');
    // Vuelve a cargar el viaje (por si ya se ha cerrado)
    await vi.waitFor(() => expect(getTrip).toHaveBeenCalledTimes(2));
    expect(page.pendingConfirm()).toBeNull();
    expect(page.isArriving()).toBe(false);
    expect(page.isConfirming()).toBe(false);
  });

  it('does nothing on «He llegado» while it is already saving', async () => {
    await render();

    page.isArriving.set(true);
    page.handleArrive();
    expect(page.pendingConfirm()).toBeNull();

    await page.handleConfirmPending();
    expect(arrive).not.toHaveBeenCalled();
  });

  it.each([
    ['PASSENGER_NOT_BOARDED', 'Aún no consta que hayas subido'],
    ['TRIP_NOT_IN_PROGRESS', 'El viaje ya no está en curso.'],
    ['INTERNAL_ERROR', 'No hemos podido marcar tu llegada'],
  ])('explains why «He llegado» failed (%s)', async (code, message) => {
    await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }));
    arrive.mockRejectedValue(new ApiError(code, 409));

    page.handleArrive();
    await page.handleConfirmPending();

    expect(showError).toHaveBeenCalledWith(expect.stringContaining(message));
    expect(page.isArriving()).toBe(false);
    expect(page.pendingConfirm()).toBeNull();
  });

  it('lets an unexpected error of «He llegado» through', async () => {
    await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }));
    arrive.mockRejectedValue(new TypeError('boom'));

    page.handleArrive();
    await expect(page.handleConfirmPending()).rejects.toThrow('boom');
    expect(showError).not.toHaveBeenCalled();
    expect(page.isArriving()).toBe(false);
  });

  it('shares the trip with someone they trust', async () => {
    await render();
    const share = vi.spyOn(TestBed.inject(TripShareService), 'share').mockResolvedValue('shared');

    await page.handleShareTrip();

    expect(share).toHaveBeenCalledWith({
      title: 'Mi viaje en Carpooling UAL',
      text: page.safetyShareText(),
    });
    expect(page.safetyShareText()).toContain('Roquetas de Mar');
  });

  it('keeps the review it sent, or none when it skips it', async () => {
    await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }), {
      ...TRIP,
      status: 'finished',
    });
    const review = { id: 'rev1', rating: 5 } as unknown as GivenReview;

    page.handleReviewDone('sent', review);
    expect(page.reviewState()).toBe('sent');
    expect(page.givenReview()).toBe(review);

    page.handleReviewDone('skipped');
    expect(page.reviewState()).toBe('skipped');
    expect(page.givenReview()).toBeNull();
  });

  it('uses the row of short buttons on a tablet, with the SOS in the corner', async () => {
    // Escritorio, pero sin el ancho de WIDE_ASIDE_MEDIA_QUERY
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === DESKTOP_MEDIA_QUERY,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }));

      expect(page.hasActionRows()).toBe(false);
      expect(root.querySelector('.live-actions--compact')).not.toBeNull();
      expect(root.querySelector('.icon-btns-open')).toBeNull();
      expect(root.querySelectorAll('.ride__side .section-item')).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the action rows on a wide screen', async () => {
    await render(request({ boardedAt: '2099-01-15T06:45:00.000Z' }));

    expect(page.hasActionRows()).toBe(true);
    expect(root.querySelector('.live-actions')).toBeNull();
    expect(root.querySelector('.live-group--actions .section-item')).not.toBeNull();
  });

  it('knows the phase of the passenger in the trip', () => {
    expect(ridePhase(request(), { ...TRIP, status: 'finished' })).toBe('finished');
    expect(ridePhase(request({ boardedAt: 'x' }), TRIP)).toBe('on_board');
    expect(ridePhase(request(), TRIP)).toBe('waiting');
  });
});
