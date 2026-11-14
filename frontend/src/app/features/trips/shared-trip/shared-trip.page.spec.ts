import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { SharedTrip } from '../../../core/models/trip-share.model';
import { TripLiveShareService } from '../../../core/services/trips/trip-live-share.service';
import { TripRouteMap } from '../../../shared/components/ui/trip-route-map/trip-route-map';
import { SharedTripPage } from './shared-trip.page';

// El mapa real carga Leaflet: aquí basta con saber qué recibe
@Component({ selector: 'app-trip-route-map', template: '' })
class FakeTripRouteMap {
  readonly route = input<unknown>();
  readonly origin = input<unknown>();
  readonly destination = input<unknown>();
  readonly car = input<unknown>();
}

const TOKEN = 'a'.repeat(43);

function sharedTrip(changes: Partial<SharedTrip> = {}): SharedTrip {
  return {
    id: 's1',
    tripStatus: 'confirmed',
    passengerState: 'waiting',
    pickupName: 'Rambla',
    pickupAt: '2026-11-14T07:40:00.000Z',
    destinationName: 'Parking P1',
    estimatedArrivalAt: '2026-11-14T08:00:00.000Z',
    driver: { firstName: 'Lucía' },
    vehicle: { brand: 'Seat', model: 'Ibiza', color: 'red', colorName: 'Rojo', plate: '1234ABC' },
    position: null,
    route: null,
    ...changes,
  };
}

describe('SharedTripPage', () => {
  let fixture: ComponentFixture<SharedTripPage>;
  const getShared = vi.fn();

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(SharedTripPage);
    fixture.componentRef.setInput('token', TOKEN);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [SharedTripPage],
      providers: [
        provideIonicAngular(),
        { provide: TripLiveShareService, useValue: { getShared } },
      ],
    });
    TestBed.overrideComponent(SharedTripPage, {
      remove: { imports: [TripRouteMap] },
      add: { imports: [FakeTripRouteMap] },
    });
  });

  afterEach(() => fixture?.destroy());

  it('shows a confirmed trip without the map and is not indexed', async () => {
    getShared.mockResolvedValue(sharedTrip());

    const page = await render();

    expect(getShared).toHaveBeenCalledWith(TOKEN);
    expect(page.textContent).toContain('Esperando la recogida');
    expect(page.textContent).toContain('Seat Ibiza · Rojo · 1234 ABC');
    expect(page.textContent).toContain('Lucía');
    expect(page.querySelector('app-trip-route-map')).toBeNull();
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('shows the car on the map while in progress', async () => {
    getShared.mockResolvedValue(
      sharedTrip({
        tripStatus: 'in_progress',
        passengerState: 'on_board',
        position: {
          location: { type: 'Point', coordinates: [-2.43, 36.83] },
          recordedAt: new Date().toISOString(),
          remainingMin: 6,
        },
        route: {
          type: 'LineString',
          coordinates: [
            [-2.46, 36.84],
            [-2.4, 36.82],
          ],
        },
      }),
    );

    const page = await render();

    expect(page.textContent).toContain('En el coche');
    expect(page.textContent).toContain('faltan unos 6 min');
    expect(page.querySelector('app-trip-route-map')).not.toBeNull();
    expect(fixture.componentInstance.carPoint()?.coordinates).toEqual([-2.43, 36.83]);
    expect(page.textContent).not.toContain('Ubicación sin actualizar');
  });

  it('warns about an old position', async () => {
    getShared.mockResolvedValue(
      sharedTrip({
        tripStatus: 'in_progress',
        position: {
          location: { type: 'Point', coordinates: [-2.43, 36.83] },
          recordedAt: '2020-01-01T00:00:00.000Z',
          remainingMin: 6,
        },
        route: {
          type: 'LineString',
          coordinates: [
            [-2.46, 36.84],
            [-2.4, 36.82],
          ],
        },
      }),
    );

    const page = await render();

    expect(page.textContent).toContain('Ubicación sin actualizar');
  });

  it('says that the link is no longer valid', async () => {
    getShared.mockRejectedValue(new ApiError('SHARE_NOT_FOUND', 404));

    const page = await render();

    expect(page.textContent).toContain('Este enlace no está disponible');
    expect(page.textContent).toContain('Este enlace ya no funciona');
  });

  it('removes the robots tag when leaving', async () => {
    getShared.mockResolvedValue(sharedTrip({ tripStatus: 'finished' }));
    await render();

    fixture.destroy();

    expect(TestBed.inject(Meta).getTag('name="robots"')).toBeNull();
  });
});
