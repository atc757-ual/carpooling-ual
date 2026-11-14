import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { LocationService } from '../../../core/services/location/location.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import {
  LIVE_TRIP_MAP_RENDERER_FACTORY,
  LOAD_LEAFLET,
} from '../passenger-requests/live-trip-map/live-trip-map-runtime';
import { TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import { DriverLiveTripPage } from './driver-live-trip.page';

@Component({ template: '' })
class BlankPage {}

// El mapa sin Leaflet: no dibuja nada
const RENDERER = {
  initialize: vi.fn(),
  render: vi.fn(),
  center: vi.fn(),
  setBottomInset: vi.fn(),
  destroy: vi.fn(),
};

const TRIP: DriverTrip = {
  id: 't1',
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
  let showInfoMock: ReturnType<typeof vi.fn>;
  let listContactsMock: ReturnType<typeof vi.fn>;
  let page: DriverLiveTripPage;

  async function render(
    trips: DriverTrip[],
    requests: SeatRequest[] = [],
    contacts = [
      { id: 'p-r1', name: 'Carlos Ruiz', phone: '+34600333444', role: 'passenger' as const },
    ],
  ): Promise<HTMLElement> {
    driver = {
      listMyTrips: vi.fn().mockResolvedValue(trips),
      listTripRequests: vi.fn().mockResolvedValue(requests),
      finishTrip: vi.fn().mockResolvedValue({ ...TRIP, status: 'finished' }),
      boardPassenger: vi.fn().mockResolvedValue({ id: 'r1', boardedAt: new Date().toISOString() }),
      markNoShow: vi.fn().mockResolvedValue({ id: 'r1', status: 'cancelled' }),
    };
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
        provideIonicAngular(),
        provideRouter([
          { path: 'tabs/trips/drive/:id', component: DriverLiveTripPage },
          { path: 'tabs/trips', component: BlankPage },
        ]),
        { provide: DriverService, useValue: driver },
        { provide: DriverTrackingService, useValue: { ...tracking, stop: vi.fn() } },
        { provide: ConfirmService, useValue: { ask } },
        {
          provide: ToastService,
          useValue: { showSuccess: vi.fn(), showError: vi.fn(), showInfo: showInfoMock },
        },
        { provide: ChatService, useValue: { listContacts: listContactsMock } },
        {
          provide: TrackingService,
          useValue: { getLatest: vi.fn().mockRejectedValue(new Error()) },
        },
        { provide: LocationService, useValue: { checkPermission: vi.fn() } },
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

  it('says the screen stays on and warns about a while without sharing', async () => {
    const root = await render([TRIP]);
    expect(root.querySelector('.driver-live-trip__sharing-hint')).toBeNull();
    expect(root.querySelector('.driver-live-trip__gap')).toBeNull();

    tracking.isScreenKeptOn.set(true);
    tracking.gapMinutes.set(4);
    TestBed.tick();

    expect(root.textContent).toContain('La pantalla no se apagará hasta que termines.');
    expect(root.querySelector('.driver-live-trip__gap')?.textContent).toContain(
      'Estuviste 4 min sin compartir tu ubicación',
    );
    page.dismissGap();
    expect(tracking.dismissGap).toHaveBeenCalled();
  });

  it('shows the trip in progress, sharing the location, with its passengers in order', async () => {
    const root = await render(
      [TRIP],
      [
        passenger('r2', 'Ana Gómez', 20),
        passenger('r1', 'Carlos Ruiz', 8),
        passenger('r3', 'Eva Gil', null),
      ],
    );

    expect(root.textContent).toContain('Compartiendo tu ubicación con tus pasajeros');
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

  it('confirms finishing in the same sheet, then offers to review the passengers', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await page.handleFinish();
    expect(page.finishCheck()).not.toBeNull();
    expect(driver['finishTrip']).not.toHaveBeenCalled();

    await page.confirmFinish();
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

    await page.handleFinish();
    page.cancelFinish();

    expect(page.finishCheck()).toBeNull();
    expect(driver['finishTrip']).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
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
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)]);
    const input = root.querySelector('.driver-live-trip__code-input') as HTMLInputElement;

    input.value = '48a2 19';
    input.dispatchEvent(new Event('input'));

    expect(page.boardCode('r1')).toBe('4821');
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

    const callBtn = root.querySelector('button.pickup-slide__icon-btn');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.getAttribute('title')).toBe('Llamar a Carlos Ruiz');
    expect(callBtn?.classList).not.toContain('pickup-slide__icon-btn--unavailable');

    page.handleCallPassenger({ id: 'p-r1', name: 'Carlos Ruiz' });
    expect(openPhoneSpy).toHaveBeenCalledWith('+34600333444');
  });

  it('shows call button as unavailable when passenger has no verified phone', async () => {
    const root = await render([TRIP], [passenger('r1', 'Carlos Ruiz', 5)], []);

    const callBtn = root.querySelector('button.pickup-slide__icon-btn');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.classList).toContain('pickup-slide__icon-btn--unavailable');

    page.handleCallPassenger({ id: 'p-r1', name: 'Carlos Ruiz' });
    expect(showInfoMock).toHaveBeenCalledWith(
      'Nadie más de este viaje tiene el teléfono verificado.',
    );
  });
});
