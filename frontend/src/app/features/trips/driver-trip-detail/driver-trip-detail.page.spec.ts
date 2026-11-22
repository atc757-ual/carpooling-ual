import { ApiError } from '../../../core/models/api-error.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonSpinner,
  provideIonicAngular,
} from '@ionic/angular';
import { Mock, vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { DriverTripDetailPage } from './driver-trip-detail.page';

function trip(id: string, extra: Partial<DriverTrip> = {}): DriverTrip {
  return {
    id,
    code: 'VJ-0001',
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 1,
    maxDetourMin: 10,
    pickupMode: 'on_route',
    maxDetourM: 500,
    stops: [],
    vehicleId: 'v1',
    origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status: 'confirmed',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
    ...extra,
  };
}

// El viaje de la lista de prueba, o TRIP_NOT_FOUND como la API
function findTrip<T extends { id: string }>(trips: readonly T[], id: string): Promise<T> {
  const trip = trips.find((candidate) => candidate.id === id);
  return trip ? Promise.resolve(trip) : Promise.reject(new ApiError('TRIP_NOT_FOUND', 404));
}

describe('DriverTripDetailPage', () => {
  let fixture: ComponentFixture<DriverTripDetailPage>;
  let myTrips: Mock<() => Promise<DriverTrip[]>>;

  async function render(trips: () => Promise<DriverTrip[]>): Promise<HTMLElement> {
    myTrips = vi.fn().mockImplementation(trips);
    TestBed.configureTestingModule({
      imports: [DriverTripDetailPage],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        {
          provide: DriverService,
          useValue: {
            getMyTrip: async (id: string) => findTrip(await myTrips(), id),
          },
        },
      ],
    });
    // Las piezas (recorrido, pasajeros y acciones) tienen sus propios tests
    TestBed.overrideComponent(DriverTripDetailPage, {
      set: {
        imports: [
          IonButton,
          IonCard,
          IonCardContent,
          IonCardHeader,
          IonCardTitle,
          IonContent,
          IonIcon,
          IonSpinner,
          TranslocoPipe,
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      },
    });
    fixture = TestBed.createComponent(DriverTripDetailPage);
    fixture.componentRef.setInput('id', 't1');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the route, the passengers and the actions of the trip in the route', async () => {
    const root = await render(() => Promise.resolve([trip('t2'), trip('t1')]));

    expect(fixture.componentInstance.trip()?.id).toBe('t1');
    expect(root.querySelector('app-driver-trip-route')).not.toBeNull();
    expect(root.querySelector('app-driver-trip-passengers')).not.toBeNull();
    expect(root.querySelector('app-driver-trip-actions')).not.toBeNull();
  });

  it('puts when, the role and the status in the fixed heading strip', async () => {
    await render(() => Promise.resolve([trip('t1')]));

    expect(TestBed.inject(HeadingContentService).content()).not.toBeNull();
    expect(fixture.componentInstance.statusLabel()).toBe('Confirmado');
    expect(fixture.componentInstance.when()).toContain('·');
  });

  it('explains that the system closed a trip that had already passed', async () => {
    const closed = { ...trip('t1'), status: 'finished' as const, finishedBy: 'system' as const };
    const root = await render(() => Promise.resolve([closed]));

    expect(fixture.componentInstance.isAutoFinished()).toBe(true);
    expect(root.querySelector('.driver-detail__auto-notice')?.textContent).toContain(
      'Este viaje ya terminó.',
    );
  });

  it('estimates the impact by passenger, and says a cancelled trip saved nothing', async () => {
    const root = await render(() => Promise.resolve([trip('t1')]));
    expect(fixture.componentInstance.impact()?.cars).toBe(2);

    myTrips.mockResolvedValue([trip('t1', { status: 'cancelled' })]);
    fixture.componentInstance.handleReload();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.impact()).toBeNull();
    expect(root.textContent).toContain('Este viaje no se realizó');
  });

  it('says so when the trip is not among those of the driver', async () => {
    const root = await render(() => Promise.resolve([trip('t2')]));

    expect(root.querySelector('app-driver-trip-route')).toBeNull();
    expect(root.textContent).toContain('No hemos podido cargar este viaje');
  });

  it('offers to retry after an error and loads it again', async () => {
    const root = await render(() => Promise.reject(new Error('down')));
    expect(root.textContent).toContain('No hemos podido cargar este viaje');

    myTrips.mockResolvedValue([trip('t1')]);
    fixture.componentInstance.handleReload();
    await fixture.whenStable();

    expect(root.querySelector('app-driver-trip-route')).not.toBeNull();
  });
});
