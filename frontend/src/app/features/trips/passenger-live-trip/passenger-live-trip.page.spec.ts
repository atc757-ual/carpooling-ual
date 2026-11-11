import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { ChatService } from '../../../core/services/chat/chat.service';
import { LocationService } from '../../../core/services/location/location.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripReviewsService } from '../../../core/services/users/trip-reviews.service';
import {
  LIVE_TRIP_MAP_RENDERER_FACTORY,
  LOAD_LEAFLET,
} from '../passenger-requests/live-trip-map/live-trip-map-runtime';
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
  destroy: vi.fn(),
};

describe('PassengerLiveTripPage', () => {
  let page: PassengerLiveTripPage;
  let root: HTMLElement;
  let showSuccess: ReturnType<typeof vi.fn>;

  async function render(req: SeatRequest = request(), trip: Trip = TRIP): Promise<void> {
    showSuccess = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideCatalogsForTests(),
        { provide: SeatRequestsService, useValue: { listMine: vi.fn().mockResolvedValue([req]) } },
        { provide: TripsService, useValue: { getTrip: vi.fn().mockResolvedValue(trip) } },
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
          useValue: { showSuccess, showError: vi.fn(), showInfo: vi.fn() },
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
        { provide: ModalController, useValue: { create: vi.fn() } },
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
    expect(root.querySelectorAll('.ride__code-digits span')).toHaveLength(4);
    expect(root.textContent).toContain('Conduce');
    expect(root.textContent).toContain('Seat Ibiza');
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
    expect(root.textContent).toContain('¡Has llegado!');
    expect(root.querySelector('app-trip-review-form')).not.toBeNull();
  });

  it('cannot be followed before the trip starts', async () => {
    await render(request(), { ...TRIP, status: 'confirmed' });

    expect(page.isLive()).toBe(false);
    expect(root.textContent).toContain('Este viaje no está en curso');
  });

  it('reports an incident in place and goes back to Tus viajes', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    page.isReportingIncident.set(true);
    TestBed.tick();
    expect(root.querySelector('app-passenger-incident-modal')).not.toBeNull();

    await page.handleIncidentReported();
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

  it('knows the phase of the passenger in the trip', () => {
    expect(ridePhase(request(), { ...TRIP, status: 'finished' })).toBe('finished');
    expect(ridePhase(request({ boardedAt: 'x' }), TRIP)).toBe('on_board');
    expect(ridePhase(request(), TRIP)).toBe('waiting');
  });
});
