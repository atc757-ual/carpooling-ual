import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { TravelPreferencesStore } from '../../../../core/services/catalogs/travel-preferences.store';
import { VehicleColorsStore } from '../../../../core/services/catalogs/vehicle-colors.store';
import { TripCallService } from '../../../../core/services/trips/trip-call.service';
import { TripsService } from '../../../../core/services/trips/trips.service';
import { PassengerRequestRoute } from './passenger-request-route';

const ORIGIN: [number, number] = [-2.46, 36.84];
const CAMPUS: [number, number] = [-2.4, 36.83];
const PICKUP: [number, number] = [-2.45, 36.835];

function trip(changes: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    status: 'confirmed',
    departureAt: '2026-11-20T07:30:00Z',
    origin: { type: 'Point', coordinates: ORIGIN },
    destination: { type: 'Point', coordinates: CAMPUS },
    originName: 'Calle Lachambre, 4',
    destinationName: 'Parking P1',
    isLocationApproximate: true,
    availableSeats: 2,
    offeredSeats: 3,
    driver: {
      id: 'd1',
      name: 'Lucía Martín',
      avatarKey: null,
      tripCount: 12,
      rating: 4.56,
      preferences: ['music'],
    },
    ...changes,
  } as Trip;
}

function request(changes: Partial<SeatRequest> = {}): SeatRequest {
  return {
    id: 'r1',
    status: 'pending',
    seats: 1,
    direction: 'to-campus',
    pickupName: null,
    pickupLocation: null,
    pickupAt: null,
    ...changes,
  } as SeatRequest;
}

describe('PassengerRequestRoute', () => {
  const loadContacts = vi.fn();
  const call = vi.fn();

  function create(seatRequest: SeatRequest, seatTrip = trip()): PassengerRequestRoute {
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideAppTransloco(),
        { provide: TripsService, useValue: { getRoute: vi.fn().mockResolvedValue(null) } },
        { provide: VehicleColorsStore, useValue: { label: () => 'Gris', swatch: () => '#808080' } },
        { provide: TravelPreferencesStore, useValue: { format: () => ['Con música'] } },
        {
          provide: TripCallService,
          useValue: {
            loadContacts,
            call,
            canCall: () => true,
            callLabel: (_contact: unknown, name: string) => `Llamar a ${name}`,
          },
        },
        { provide: ModalController, useValue: { create: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(PassengerRequestRoute);
    fixture.componentRef.setInput('request', seatRequest);
    fixture.componentRef.setInput('trip', seatTrip);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    loadContacts.mockResolvedValue([{ role: 'driver', name: 'Lucía Martín', phone: '600000000' }]);
  });

  it('marks its own pickup on the map and keeps the origin approximate until accepted', () => {
    const route = create(request({ pickupLocation: { type: 'Point', coordinates: PICKUP } }));

    expect(route.pickupPoints()).toEqual([{ coordinates: PICKUP, label: 'Tu punto de recogida' }]);
    expect(route.mapEnds().origin.isApproximate).toBe(true);
    expect(route.mapEnds().destination.isApproximate).toBe(false);
  });

  it('shows the exact origin once the seat is accepted', () => {
    const route = create(request({ status: 'accepted' }));

    expect(route.mapEnds().origin.isApproximate).toBe(false);
  });

  it('picks up at the campus when going home', () => {
    const route = create(request({ direction: 'from-campus' }));

    expect(route.pickupName()).toBe('Calle Lachambre, 4');
    expect(route.pickupPoints()).toEqual([{ coordinates: ORIGIN, label: 'Calle Lachambre, 4' }]);
  });

  it('lists the stops with the pickup time once it is known', () => {
    const route = create(
      request({ pickupName: 'Avenida del Mediterráneo, 120', pickupAt: '2026-11-20T07:42:00Z' }),
    );
    const stops = route.stops();

    expect(stops.map((stop) => stop.name)).toEqual([
      'Calle Lachambre, 4',
      'Avenida del Mediterráneo, 120',
      'Parking P1',
    ]);
    expect(stops[1].time).toMatch(/^\d\d:\d\d$/);
    expect(stops[2].detail).toBe('Llegada aproximada');
  });

  it('gives the seats asked for and the seats still free', () => {
    const route = create(request({ seats: 2 }));

    expect(route.facts().map((fact) => fact.label)).toEqual(['Plazas que pides', 'Plazas libres']);
  });

  it('shows the driver with the rating rounded to one decimal', () => {
    const route = create(request());

    expect(route.driver()).toMatchObject({ id: 'd1', name: 'Lucía Martín', tripCount: 12 });
    expect(route.rating()).toBe('4,6');
    expect(route.preferences()).toEqual(['Con música']);
  });

  // Si tuvo plaza, su nombre abre el perfil del conductor (y no se repiten sus
  // preferencias); sus compañeros, solo mientras la tiene
  it.each<[SeatRequest['status'], string | null, boolean, boolean]>([
    ['accepted', '2099-01-14T11:00:00.000Z', true, true],
    ['completed', '2099-01-14T11:00:00.000Z', true, true],
    ['cancelled', '2099-01-14T11:00:00.000Z', true, false],
    ['cancelled', null, false, false],
    ['pending', null, false, false],
    ['rejected', '2099-01-14T11:00:00.000Z', false, false],
  ])(
    'with the request %s (answered at %s): had a seat %s, holds it %s',
    (status, answeredAt, hadSeat, holdsSeat) => {
      const route = create(request({ status, answeredAt }));

      expect(route.hadSeat()).toBe(hadSeat);
      expect(route.holdsSeat()).toBe(holdsSeat);
    },
  );

  it('offers the chat only with an accepted seat on a confirmed or started trip', () => {
    expect(create(request({ status: 'accepted' })).hasChat()).toBe(true);
    TestBed.resetTestingModule();
    expect(create(request({ status: 'pending' })).hasChat()).toBe(false);
    TestBed.resetTestingModule();
    expect(create(request({ status: 'accepted' }), trip({ status: 'finished' })).hasChat()).toBe(
      false,
    );
  });

  it('calls the driver by name', () => {
    const route = create(request({ status: 'accepted' }));

    expect(route.chatDriverLabel()).toContain('Lucía');
    expect(route.callDriverLabel()).toBe('Llamar a Lucía');
    route.handleCallDriver();
    expect(call).toHaveBeenCalledWith(null, 'confirmed');
  });
});
