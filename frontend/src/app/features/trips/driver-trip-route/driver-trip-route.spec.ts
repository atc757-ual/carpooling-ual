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
};

describe('DriverTripRoute', () => {
  let fixture: ComponentFixture<DriverTripRoute>;

  async function render(getRoute: () => Promise<unknown>): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [DriverTripRoute],
      providers: [
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
        imports: [IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonSpinner],
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
});
