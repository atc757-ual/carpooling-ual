import { TranslocoPipe } from '@jsverse/transloco';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
  provideIonicAngular,
} from '@ionic/angular';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';
import { TripsService } from '../../../core/services/trips/trips.service';
import { DriverTripRoute } from './driver-trip-route';

const TRIP: DriverTrip = {
  id: 't1',
  code: 'VJ-0001',
  departureAt: '2099-01-15T07:00:00.000Z',
  offeredSeats: 3,
  availableSeats: 2,
  maxDetourMin: 10,
  pickupMode: 'on_route',
  maxDetourM: 500,
  stops: [],
  vehicleId: 'v1',
  origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  status: 'published',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
};

const ROUTE = {
  tripId: 't1',
  distanceKm: 29.34,
  durationMin: 31,
  geometry: null,
  source: 'osrm' as const,
  tripStatus: 'published' as const,
  estimatedArrivalAt: null,
};

describe('DriverTripRoute', () => {
  let fixture: ComponentFixture<DriverTripRoute>;

  async function render(getRoute: () => Promise<unknown>): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DriverTripRoute],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        provideCatalogsForTests(),
        {
          provide: TripsService,
          useValue: {
            getTrip: vi.fn().mockResolvedValue({
              ...TRIP,
              vehicle: { brand: 'Seat', model: 'Ibiza', color: 'blue' },
            }),
            getRoute: vi.fn().mockImplementation(getRoute),
          },
        },
      ],
    });
    // El mapa (Leaflet) y la línea de paradas tienen sus propios tests
    TestBed.overrideComponent(DriverTripRoute, {
      set: {
        imports: [
          IonCard,
          IonCardContent,
          IonCardHeader,
          IonCardTitle,
          IonIcon,
          IonSpinner,
          TranslocoPipe,
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });
    fixture = TestBed.createComponent(DriverTripRoute);
    fixture.componentRef.setInput('trip', TRIP);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('gives the arrival from the route and the facts of the trip', async () => {
    const root = await render(() => Promise.resolve(ROUTE));
    const [departure, arrival] = fixture.componentInstance.stops();

    expect(departure).toMatchObject({ name: 'Roquetas de Mar', detail: 'Sales de aquí' });
    expect(arrival.name).toBe('Campus UAL · Parking P1 (Sur)');
    expect(arrival.time).toBeDefined();
    expect(fixture.componentInstance.facts().map(({ value }) => value)).toEqual([
      '29,3 km',
      '31 min',
      '10 min',
    ]);
    expect(root.textContent).toContain('Seat Ibiza');
  });

  it('keeps the stops and the detour when the route cannot be loaded', async () => {
    const root = await render(() => Promise.reject(new Error('down')));

    expect(fixture.componentInstance.stops()[1].time).toBeUndefined();
    expect(fixture.componentInstance.facts().map(({ value }) => value)).toEqual([
      '—',
      '—',
      '10 min',
    ]);
    expect(root.textContent).toContain('No pudimos cargar el mapa de la ruta');
  });

  it('loads the trip again when its car changes, not on every reload', async () => {
    await render(() => Promise.resolve(ROUTE));
    const getTrip = vi.mocked(TestBed.inject(TripsService).getTrip);
    expect(getTrip).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('trip', { ...TRIP, availableSeats: 1 });
    await fixture.whenStable();
    expect(getTrip).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('trip', { ...TRIP, vehicleId: 'v2' });
    await fixture.whenStable();
    expect(getTrip).toHaveBeenCalledTimes(2);
  });

  it('builds route stops and pickup points for predefined stops and on-route accepted requests', async () => {
    const { buildDriverRouteStops } = await import('./driver-route-stops');
    const { DriverService } = await import('../../../core/services/drivers/driver.service');

    // Direct unit coverage of buildDriverRouteStops with predefined stops (0, 1, 2, 3+ passengers)
    const stopsWithPredefined = buildDriverRouteStops(
      {
        departureAt: '2099-01-15T07:00:00.000Z',
        originName: null,
        destinationName: null,
        stops: [
          {
            id: 's1',
            position: 1,
            name: 'Parada 1',
            estimatedAt: '2099-01-15T07:10:00.000Z',
            location: { type: 'Point', coordinates: [-2.5, 36.8] },
          },
          {
            id: 's2',
            position: 2,
            name: 'Parada 2',
            estimatedAt: '2099-01-15T07:20:00.000Z',
            location: { type: 'Point', coordinates: [-2.45, 36.82] },
          },
        ],
      },
      [
        {
          id: 'r1',
          stopId: 's1',
          passenger: { id: 'p1', name: 'Ana García' },
        } as never,
        {
          id: 'r2',
          stopId: 's1',
          passenger: { id: 'p2', name: 'Leo Martín' },
        } as never,
        {
          id: 'r3',
          stopId: 's1',
          passenger: { id: 'p3', name: 'Pía López' },
        } as never,
      ],
      ROUTE,
    );
    expect(stopsWithPredefined[0].name).toBe('Salida');
    expect(stopsWithPredefined[1].detail).toContain('Ana, Leo y Pía');

    // On-route accepted pickups with and without pickupName / pickupAt
    const stopsOnRoute = buildDriverRouteStops(
      {
        departureAt: '2099-01-15T07:00:00.000Z',
        originName: 'Almería',
        destinationName: 'UAL',
        stops: [],
      },
      [
        {
          id: 'r1',
          pickupName: 'Auditorio',
          pickupAt: '2099-01-15T07:15:00.000Z',
          passenger: { id: 'p1', name: 'Ana' },
        } as never,
        {
          id: 'r2',
          pickupName: null,
          pickupAt: null,
          passenger: { id: 'p2', name: 'Leo' },
        } as never,
      ],
      null,
    );
    expect(stopsOnRoute).toHaveLength(4);

    // Component pickupPoints with predefined stops vs accepted requests vs cancelled trip
    await render(() => Promise.resolve(ROUTE));
    const driverSvc = TestBed.inject(DriverService);
    vi.spyOn(driverSvc, 'listTripRequests').mockResolvedValue([
      {
        id: 'r1',
        status: 'accepted',
        pickupAt: '2099-01-15T07:15:00.000Z',
        pickupLocation: { type: 'Point', coordinates: [-2.5, 36.8] },
        passenger: { id: 'p1', name: 'Ana' },
      } as never,
      {
        id: 'r2',
        status: 'completed',
        pickupAt: '2099-01-15T07:10:00.000Z',
        pickupLocation: { type: 'Point', coordinates: [-2.55, 36.79] },
        passenger: { id: 'p2', name: 'Leo' },
      } as never,
    ]);

    fixture.componentRef.setInput('trip', { ...TRIP, status: 'confirmed' });
    await fixture.whenStable();
    expect(fixture.componentInstance.pickupPoints()).toHaveLength(2);

    fixture.componentRef.setInput('trip', {
      ...TRIP,
      originName: null,
      destinationName: null,
      status: 'cancelled',
      stops: [
        {
          id: 's1',
          position: 1,
          name: 'Centro',
          estimatedAt: '2099-01-15T07:10:00.000Z',
          location: { type: 'Point', coordinates: [-2.5, 36.8] },
        },
      ],
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.origin().label).toBe('Salida');
    expect(fixture.componentInstance.destination().label).toBe('Destino');
    expect(fixture.componentInstance.pickupPoints()).toHaveLength(1);
  });
});
