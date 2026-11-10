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
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { DriverTripDetailPage } from './driver-trip-detail.page';

function trip(id: string, extra: Partial<DriverTrip> = {}): DriverTrip {
  return {
    id,
    departureAt: '2099-01-15T06:40:00.000Z',
    offeredSeats: 3,
    availableSeats: 1,
    maxDetourMin: 10,
    vehicleId: 'v1',
    origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
    destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
    status: 'confirmed',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL · Parking P1 (Sur)',
    ...extra,
  };
}

describe('DriverTripDetailPage', () => {
  let fixture: ComponentFixture<DriverTripDetailPage>;
  let listMyTrips: ReturnType<typeof vi.fn>;

  async function render(trips: () => Promise<DriverTrip[]>): Promise<HTMLElement> {
    listMyTrips = vi.fn().mockImplementation(trips);
    TestBed.configureTestingModule({
      imports: [DriverTripDetailPage],
      providers: [provideIonicAngular(), { provide: DriverService, useValue: { listMyTrips } }],
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

  it('estimates the impact by passenger, and says a cancelled trip saved nothing', async () => {
    const root = await render(() => Promise.resolve([trip('t1')]));
    expect(fixture.componentInstance.impact()?.cars).toBe(2);

    listMyTrips.mockResolvedValue([trip('t1', { status: 'cancelled' })]);
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

    listMyTrips.mockResolvedValue([trip('t1')]);
    fixture.componentInstance.handleReload();
    await fixture.whenStable();

    expect(root.querySelector('app-driver-trip-route')).not.toBeNull();
  });
});
