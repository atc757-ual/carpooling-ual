import { ApiError } from '../../../core/models/api-error.model';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { IonInputOtp, ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import {
  LIVE_TRIP_MAP_RENDERER_FACTORY,
  LOAD_LEAFLET,
} from '../passenger-requests/live-trip-map/live-trip-map-runtime';
import { TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import { DESKTOP_MEDIA_QUERY } from '../../../shared/utils/desktop-query.util';
import { DriverLiveTripPage } from './driver-live-trip.page';

@Component({ template: '' })
class BlankPage {}

// El mapa sin Leaflet: no dibuja nada
const RENDERER = {
  initialize: vi.fn(),
  render: vi.fn(),
  center: vi.fn(),
  setBottomInset: vi.fn(),
  setCarTitle: vi.fn(),
  destroy: vi.fn(),
};

const TRIP: DriverTrip = {
  id: 't1',
  code: 'VJ-0001',
  departureAt: new Date().toISOString(),
  offeredSeats: 3,
  availableSeats: 0,
  maxDetourMin: 10,
  pickupMode: 'on_route',
  maxDetourM: 500,
  stops: [],
  vehicleId: 'v1',
  origin: { type: 'Point', coordinates: [-2.6, 36.76] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  status: 'in_progress',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
};

function passenger(id: string, name: string, minutesFromNow: number | null): SeatRequest {
  return {
    id,
    trip: { id: 't1' },
    passenger: { id: `p-${id}`, name },
    status: 'accepted',
    isPriority: false,
    seats: 1,
    pickupLocation: minutesFromNow === null ? null : { type: 'Point', coordinates: [-2.5, 36.8] },
    pickupName: minutesFromNow === null ? null : `Parada de ${name}`,
    pickupAt:
      minutesFromNow === null ? null : new Date(Date.now() + minutesFromNow * 60_000).toISOString(),
    requestedAt: new Date().toISOString(),
    answeredAt: null,
    cancelledAt: null,
    vehiclePlate: null,
  };
}

// El viaje de la lista de prueba, o TRIP_NOT_FOUND como la API
function findTrip<T extends { id: string }>(trips: readonly T[], id: string): Promise<T> {
  const trip = trips.find((candidate) => candidate.id === id);
  return trip ? Promise.resolve(trip) : Promise.reject(new ApiError('TRIP_NOT_FOUND', 404));
}

describe('DriverLiveTripPage', () => {
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let tracking: {
    tripId: ReturnType<typeof signal<string | null>>;
    isScreenKeptOn: ReturnType<typeof signal<boolean>>;
    gapMinutes: ReturnType<typeof signal<number | null>>;
    start: ReturnType<typeof vi.fn>;
    dismissGap: ReturnType<typeof vi.fn>;
  };
  let ask: ReturnType<typeof vi.fn>;
  // La ventana del formulario de la incidencia (escritorio): se envía
  const createModal = vi.fn().mockResolvedValue({
    present: () => Promise.resolve(),
    onWillDismiss: () => Promise.resolve({ data: { reported: true } }),
  });
  let showInfoMock: ReturnType<typeof vi.fn>;
  let listContactsMock: ReturnType<typeof vi.fn>;
  let showSuccessMock: ReturnType<typeof vi.fn>;
  let showErrorMock: ReturnType<typeof vi.fn>;
  let stopTracking: ReturnType<typeof vi.fn>;
  let page: DriverLiveTripPage;

  async function render(
    trips: DriverTrip[],
    requests: SeatRequest[] = [],
    contacts = [
      { id: 'p-r1', name: 'Carlos Ruiz', phone: '+34600333444', role: 'passenger' as const },
    ],
  ): Promise<HTMLElement> {
    driver = {
      getMyTrip: vi.fn().mockImplementation((id: string) => findTrip(trips, id)),
      listTripRequests: vi.fn().mockResolvedValue(requests),
      finishTrip: vi.fn().mockResolvedValue({ ...TRIP, status: 'finished' }),
      boardPassenger: vi.fn().mockResolvedValue({ id: 'r1', boardedAt: new Date().toISOString() }),
      markNoShow: vi.fn().mockResolvedValue({ id: 'r1', status: 'cancelled' }),
      dropOffPassenger: vi.fn(),
    };
    showSuccessMock = vi.fn();
    showErrorMock = vi.fn();
    stopTracking = vi.fn();
    tracking = {
      tripId: signal<string | null>('t1'),
      isScreenKeptOn: signal(false),
      gapMinutes: signal<number | null>(null),
      start: vi.fn(),
      dismissGap: vi.fn(),
    };
    ask = vi.fn().mockResolvedValue(true);
    showInfoMock = vi.fn().mockResolvedValue(undefined);
    listContactsMock = vi.fn().mockResolvedValue(contacts);
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideRouter([
          { path: 'tabs/trips/drive/:id', component: DriverLiveTripPage },
          { path: 'tabs/trips', component: BlankPage },
        ]),
        { provide: DriverService, useValue: driver },
        { provide: DriverTrackingService, useValue: { ...tracking, stop: stopTracking } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ModalController, useValue: { create: createModal } },
        {
          provide: ToastService,
          useValue: {
            showSuccess: showSuccessMock,
            showError: showErrorMock,
            showInfo: showInfoMock,
          },
        },
        { provide: ChatService, useValue: { listContacts: listContactsMock } },
        {
          provide: TrackingService,
          useValue: { getLatest: vi.fn().mockRejectedValue(new Error()) },
        },
        {
          provide: LocationService,
          useValue: {
            checkPermission: vi.fn(),
            getCurrentPoint: vi.fn().mockRejectedValue(new LocationError('unavailable')),
          },
        },
        { provide: LOAD_LEAFLET, useValue: vi.fn().mockResolvedValue({}) },
        { provide: LIVE_TRIP_MAP_RENDERER_FACTORY, useValue: () => RENDERER },
        {
          provide: TripReviewsService,
          useValue: {
            listGiven: vi.fn().mockResolvedValue([]),
            listPending: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl('/tabs/trips/drive/t1', DriverLiveTripPage);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('warns about a while without sharing', async () => {
    const root = await render([TRIP]);
    expect(root.querySelector('.driver-live-trip__gap')).toBeNull();

    tracking.gapMinutes.set(4);
    TestBed.tick();

    expect(root.querySelector('.driver-live-trip__gap')?.textContent).toContain(
      'Estuviste 4 min sin compartir tu ubicación',
    );
    page.dismissGap();
    expect(tracking.dismissGap).toHaveBeenCalled();
  });

  it('shows the trip in progress with its passengers in order', async () => {
    const root = await render(
      [TRIP],
      [
        passenger('r2', 'Ana Gómez', 20),
        passenger('r1', 'Carlos Ruiz', 8),
        passenger('r3', 'Eva Gil', null),
      ],
    );

    expect(tracking.start).toHaveBeenCalledWith('t1');
    expect(page.passengers().map(({ passenger: { name } }) => name)).toEqual([
      'Carlos Ruiz',
      'Ana Gómez',
      'Eva Gil',
    ]);
    expect(page.nextPickup()?.id).toBe('r1');
    // Lo siguiente, en la tarjeta «En directo»; en el carrusel, solo la de quien toca
    expect(root.querySelector('.live-hero__title')?.textContent).toContain('Recoge a Carlos');
    expect(root.querySelector('.pickup-slide--active')?.textContent).toContain('Carlos');
    expect(root.querySelectorAll('.pickup-slide')).toHaveLength(3);
    // Cada pasajero, con su correo y sin abrir su perfil (sería una ventana sobre la hoja)
    expect(root.querySelectorAll('.pickup-slide app-participant-email')).toHaveLength(3);
    expect(root.querySelector('.pickup-slide app-participant-link')).toBeNull();
    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain('Recogidas');
  });

  it('moves on to the next pickup 5 minutes after the time of the previous one', async () => {
    await render([TRIP], [passenger('r1', 'Carlos Ruiz', -6), passenger('r2', 'Ana Gómez', 10)]);

    expect(page.nextPickup()?.id).toBe('r2');
  });

  it('says when the trip has no passengers or the location is not being shared', async () => {
    const root = await render([TRIP]);
    tracking.tripId.set(null);
    TestBed.tick();

    expect(root.textContent).toContain('Viajas sin pasajeros.');
    expect(page.nextPickup()).toBeNull();
    expect(page.isSharing()).toBe(false);
  });

  it('explains that a trip not in progress cannot be followed here', async () => {
    const root = await render([{ ...TRIP, status: 'confirmed' }]);

    expect(root.textContent).toContain('Este viaje no está en curso');
    expect(driver['listTripRequests']).not.toHaveBeenCalled();
    expect(tracking.start).not.toHaveBeenCalled();
  });

  it('says when the trip is not one of the driver', async () => {
    const root = await render([]);

    expect(root.textContent).toContain('No encontramos este viaje');
  });

  it('on desktop asks to finish in a dialog, then offers to review the passengers', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleFinish();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ header: '¿Terminar el viaje?' }));
    // Sin posición (la prueba no tiene GPS): termina sin ella
    expect(driver['finishTrip']).toHaveBeenCalledWith('t1', null);
    expect(page.justFinished()).toBe(true);
    expect(page.reviewTargets()).toEqual([{ id: 'p-r1', name: 'Carlos' }]);
    expect(navigate).not.toHaveBeenCalled();

    await page.leaveFinished();
    expect(navigate).toHaveBeenCalledWith('/tabs/trips');
    expect(page.isFinishing()).toBe(false);
    expect(root).toBeTruthy();
  });

  it('stays in the trip when finishing is dismissed', async () => {
    await render([TRIP]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    ask.mockResolvedValueOnce(false);
    await page.handleFinish();

    expect(page.finishCheck()).toBeNull();
    expect(driver['finishTrip']).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('asks to finish inline in the sheet on mobile without opening a dialog', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    try {
      await render([TRIP]);
      await page.handleFinish();

      expect(page.finishCheck()).not.toBeNull();
      expect(ask).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pauses the map while the page is not visible', async () => {
    await render([TRIP]);

    page.ionViewDidLeave();
    expect(page.isPageVisible()).toBe(false);
    page.ionViewWillEnter();
    expect(page.isPageVisible()).toBe(true);
  });

  it('validates boarding when entering 4-digit code', async () => {
    await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);

    page.setBoardCode('r1', '4821');
    expect(page.boardCode('r1')).toBe('4821');

    await page.handleBoard('r1');
    expect(driver['boardPassenger']).toHaveBeenCalledWith('r1', '4821');
  });

  it('keeps only up to 4 digits of what the driver types in the code field', async () => {
    await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);

    page.setBoardCode('r1', '48a2 19');

    expect(page.boardCode('r1')).toBe('4821');
  });

  it('validates on its own when the fourth digit is typed', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    page.setBoardCode('r1', '4821');

    root.querySelector('ion-input-otp')?.dispatchEvent(new CustomEvent('ionComplete'));
    await Promise.resolve();

    expect(driver['boardPassenger']).toHaveBeenCalledWith('r1', '4821');
  });

  it('does not validate an incomplete code nor twice at once', async () => {
    await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    page.setBoardCode('r1', '482');
    await page.handleBoard('r1');
    expect(driver['boardPassenger']).not.toHaveBeenCalled();

    page.setBoardCode('r1', '4821');
    const first = page.handleBoard('r1');
    await page.handleBoard('r1');
    await first;
    expect(driver['boardPassenger']).toHaveBeenCalledTimes(1);
  });

  it('clears the code and focuses the first box when it is wrong', async () => {
    await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    vi.useFakeTimers();
    driver['boardPassenger'].mockRejectedValueOnce(new Error('wrong code'));
    const codeInput = { setFocus: vi.fn().mockResolvedValue(undefined) };
    page.setBoardCode('r1', '1111');

    await page.handleBoard('r1', codeInput as unknown as IonInputOtp);
    vi.runAllTimers();

    expect(page.boardCode('r1')).toBe('');
    expect(page.isValidatingBoard('r1')).toBe(false);
    expect(codeInput.setFocus).toHaveBeenCalledWith(0);
    vi.useRealTimers();
  });

  it('marks no-show when confirmed after 5 minutes of grace period', async () => {
    const latePassenger = passenger('r1', 'Carlos Ruiz', -10);
    await render([TRIP], [latePassenger]);

    expect(page.canMarkNoShow(latePassenger)).toBe(true);
    await page.handleNoShow('r1');
    expect(driver['markNoShow']).toHaveBeenCalledWith('r1');
  });

  it('renders call button for passenger and calls passenger when tapped', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    const tripCall = TestBed.inject(TripCallService);
    const openPhoneSpy = vi.spyOn(tripCall, 'openPhone').mockImplementation(() => undefined);

    const callBtn = root.querySelector('.pickup-slide__actions button[aria-label^="Llamar"]');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.getAttribute('aria-label')).toBe('Llamar a Carlos Ruiz');
    expect(callBtn?.hasAttribute('disabled')).toBe(false);

    page.handleCallPassenger({ id: 'p-r1', name: 'Carlos Ruiz' });
    expect(openPhoneSpy).toHaveBeenCalledWith('+34600333444');
  });

  it('disables the call button when the passenger does not share their phone', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)], []);

    const callBtn = root.querySelector('.pickup-slide__actions button[aria-label^="Llamar"]');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.hasAttribute('disabled')).toBe(true);

    page.handleCallPassenger({ id: 'p-r1', name: 'Carlos Ruiz' });
    expect(showInfoMock).toHaveBeenCalledWith('No comparte su teléfono. Escríbele por el chat.');
  });

  it('keeps the SOS and, on desktop, reports an incident in a dialog', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    expect(root.querySelector('[aria-label="SOS: llamar al 112"]')?.getAttribute('href')).toBe(
      'tel:112',
    );

    await page.handleReport();
    expect(createModal).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { tripId: 't1', isDriver: true } }),
    );
    expect(page.isReportingIncident()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/tabs/trips');
  });

  it('stays in the trip when the incident dialog is dismissed without reporting', async () => {
    await render([TRIP]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    createModal.mockResolvedValueOnce({
      present: () => Promise.resolve(),
      onWillDismiss: () => Promise.resolve({ data: undefined }),
    });

    await page.handleReport();
    expect(showSuccessMock).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the inline incident form on mobile and ignores reporting without a trip', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    try {
      await render([]);
      createModal.mockClear();
      await page.handleReport();
      expect(page.isReportingIncident()).toBe(false);
      expect(createModal).not.toHaveBeenCalled();

      TestBed.resetTestingModule();
      await render([TRIP]);
      await page.handleReport();
      expect(page.isReportingIncident()).toBe(true);
      expect(createModal).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  const onBoard = (id: string, name: string): SeatRequest => ({
    ...passenger(id, name, -10),
    boardedAt: new Date().toISOString(),
  });

  it('asks «Ha bajado» in the sheet and closes that seat only', async () => {
    const carlos = onBoard('r1', 'Carlos Ruiz');
    await render([TRIP], [carlos, onBoard('r2', 'Ana Gil')]);
    driver['dropOffPassenger'].mockResolvedValue({ ...carlos, status: 'completed' });

    page.handleDropOff(carlos);
    expect(page.pendingDropOff()).toBe(carlos);

    const saving = page.confirmDropOff(carlos);
    expect(page.isDroppingOff('r1')).toBe(true);
    await saving;

    expect(driver['dropOffPassenger']).toHaveBeenCalledWith('r1');
    expect(page.passengers().map(({ id, status }) => [id, status])).toEqual([
      ['r1', 'completed'],
      ['r2', 'accepted'],
    ]);
    expect(page.isDroppingOff('r1')).toBe(false);
    expect(page.pendingDropOff()).toBeNull();
    // Aún queda Ana: la tarjeta pasa a ella y el viaje sigue
    expect(page.focusPassengerId()).toBe('r2');
    expect(page.justFinished()).toBe(false);
  });

  it('finishes the trip when the last passenger gets off', async () => {
    const carlos = onBoard('r1', 'Carlos Ruiz');
    await render([TRIP], [carlos]);
    driver['dropOffPassenger'].mockResolvedValue({ ...carlos, status: 'completed' });

    await page.confirmDropOff(carlos);
    TestBed.tick();

    expect(page.justFinished()).toBe(true);
    expect(stopTracking).toHaveBeenCalled();
    expect(showSuccessMock).toHaveBeenCalledWith('Se han bajado todos: viaje terminado.');
  });

  it('explains why «Ha bajado» failed and keeps the passenger on board', async () => {
    const carlos = onBoard('r1', 'Carlos Ruiz');
    await render([TRIP], [carlos]);
    driver['dropOffPassenger'].mockRejectedValue(new Error('offline'));

    page.handleDropOff(carlos);
    await page.confirmDropOff(carlos);

    expect(showErrorMock).toHaveBeenCalled();
    expect(page.passengers()[0].status).toBe('accepted');
    expect(page.pendingDropOff()).toBeNull();
    expect(page.isDroppingOff('r1')).toBe(false);
  });

  it('shares the trip with someone they trust', async () => {
    await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    const share = vi.spyOn(TestBed.inject(TripShareService), 'share').mockResolvedValue('shared');

    await page.handleShareTrip();

    expect(share).toHaveBeenCalledWith({
      title: 'Mi viaje en Carpooling UAL',
      text: page.safetyShareText(),
    });
  });

  describe('on a tablet (768 to 1023 px)', () => {
    // Escritorio, pero sin el ancho de WIDE_ASIDE_MEDIA_QUERY
    beforeEach(() =>
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === DESKTOP_MEDIA_QUERY,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    afterEach(() => vi.unstubAllGlobals());

    it('uses the row of short buttons, with the SOS in the corner', async () => {
      const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);

      expect(page.hasActionRows()).toBe(false);
      expect(root.querySelector('.live-actions--compact')).not.toBeNull();
      expect(root.querySelector('.live-actions [aria-label="SOS: llamar al 112"]')).not.toBeNull();
      expect(root.querySelector('.icon-btns-open')).toBeNull();
      expect(root.querySelectorAll('.section-item')).toHaveLength(0);
    });

    it('keeps the pickup arrows in the header', async () => {
      const root = await render(
        [TRIP],
        [passenger('r1', 'Carlos Ruiz', 5), passenger('r2', 'Ana Gil', 15)],
      );

      expect(root.querySelectorAll('.pickups-head .pickup-arrow')).toHaveLength(2);
      expect(root.querySelector('.pickup-carousel__arrows')).toBeNull();
    });
  });

  it('keeps the action rows and the arrows in the header on a wide screen', async () => {
    const root = await render(
      [TRIP],
      [passenger('r1', 'Carlos Ruiz', 5), passenger('r2', 'Ana Gil', 15)],
    );

    expect(page.hasActionRows()).toBe(true);
    expect(root.querySelector('.live-actions')).toBeNull();
    expect(root.querySelector('.live-group--actions .section-item')).not.toBeNull();
    expect(root.querySelectorAll('.pickups-head .pickup-arrow')).toHaveLength(2);
    expect(root.querySelector('.pickup-carousel__arrows')).toBeNull();
  });

  it('covers carousel scroll, no-show cancellation/error, pickupPlace branches, and finish guards', async () => {
    const pWithoutPickupAt = passenger('r1', 'Carlos Ruiz', null);
    await render(
      [{ ...TRIP, destinationName: 'Roquetas de Mar' }],
      [pWithoutPickupAt],
    );

    expect(page.allOnBoard()).toBe(false);
    expect(page.isToCampus()).toBe(false);
    expect(page.destinationIcon()).toBeDefined();
    expect(page.noShowWaitMinutes(pWithoutPickupAt)).toBeGreaterThanOrEqual(1);

    // Carousel scroll with clientWidth > 0 and clientWidth === 0
    page.handleCarouselScroll({
      target: { clientWidth: 200, scrollLeft: 400 },
    } as unknown as Event);
    expect(page.carouselIndex()).toBe(2);
    page.handleCarouselScroll({
      target: { clientWidth: 0, scrollLeft: 400 },
    } as unknown as Event);
    expect(page.carouselIndex()).toBe(2);

    // pickupPlace for from-campus and missing pickupName
    const pickupPlace = (
      page as unknown as { pickupPlace: (r: SeatRequest) => string }
    ).pickupPlace.bind(page);
    expect(pickupPlace({ ...pWithoutPickupAt, direction: 'from-campus' })).toBeTruthy();
    expect(pickupPlace({ ...pWithoutPickupAt, direction: 'to-campus', pickupName: null })).toBeTruthy();

    // handleNoShow cancelled and rejected
    ask.mockResolvedValueOnce(false);
    await page.handleNoShow('r1');
    expect(driver['markNoShow']).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);
    driver['markNoShow'].mockRejectedValueOnce(new Error('no show error'));
    await page.handleNoShow('r1');
    expect(showErrorMock).toHaveBeenCalled();

    // handleFinish and confirmFinish guard branches and failure
    page.isFinishing.set(true);
    await page.handleFinish();
    await page.confirmFinish();
    page.isFinishing.set(false);
    await page.confirmFinish(); // finishCheck is null

    page.finishCheck.set({ isFar: false, distance: 50, point: null });
    driver['finishTrip'].mockRejectedValueOnce(new Error('finish error'));
    await page.confirmFinish();
    expect(page.justFinished()).toBe(false);

    page.ionViewWillLeave();

    // No trip fallback for getPickupReferenceMs and safetyShareText
    page.tripResource.set(undefined as never);
    expect(page.safetyShareText()).toBe('');
    expect(page.canMarkNoShow(pWithoutPickupAt)).toBe(true);
  });
});
