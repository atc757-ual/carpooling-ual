import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TripRoute } from '../../../../core/models/trip-route.model';
import { RoutePoint, TripRouteMap } from './trip-route-map';

const ROUTE: TripRoute = {
  tripId: 't1',
  distanceKm: 18.4,
  durationMin: 21,
  geometry: {
    type: 'LineString',
    coordinates: [
      [-2.6132, 36.7642],
      [-2.4053, 36.8297],
    ],
  },
  source: 'osrm',
  tripStatus: 'confirmed',
  startedAt: null,
  estimatedArrivalAt: null,
};
const ORIGIN: RoutePoint = { coordinates: [-2.6132, 36.7642], label: 'Roquetas de Mar' };
const PICKUP: RoutePoint = { coordinates: [-2.55, 36.78], label: 'Aguadulce' };
const DESTINATION: RoutePoint = { coordinates: [-2.4053, 36.8297], label: 'Campus UAL' };

describe('TripRouteMap', () => {
  let fixture: ComponentFixture<TripRouteMap>;
  const observe = vi.fn();
  const disconnect = vi.fn();

  async function render(
    pickup?: RoutePoint,
    { route = ROUTE, origin = ORIGIN }: { route?: TripRoute; origin?: RoutePoint } = {},
  ): Promise<HTMLElement> {
    fixture = TestBed.createComponent(TripRouteMap);
    fixture.componentRef.setInput('route', route);
    fixture.componentRef.setInput('origin', origin);
    fixture.componentRef.setInput('destination', DESTINATION);
    if (pickup) {
      fixture.componentRef.setInput('pickups', [pickup]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    // Leaflet se carga con un import dinámico: se espera a que pinte
    await vi.waitFor(() => expect(observe).toHaveBeenCalled());
    return fixture.nativeElement as HTMLElement;
  }

  const legend = (root: HTMLElement): string[] =>
    [...root.querySelectorAll('.trip-route-map__legend-item')].map(
      (item) => item.textContent?.trim() ?? '',
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('draws the start and the destination, without a pickup', async () => {
    const root = await render();

    expect(legend(root)).toEqual(['S Salida', 'D Destino']);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Ruta del conductor: Roquetas de Mar a Campus UAL',
    );
    expect(root.querySelectorAll('.trip-route-map__marker')).toHaveLength(2);
  });

  it('adds the pickup when there is one', async () => {
    const root = await render(PICKUP);

    expect(legend(root)).toEqual(['S Salida', 'R Recogida', 'D Destino']);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      'recogida en Aguadulce',
    );
    expect(root.querySelectorAll('.trip-route-map__marker--pickup')).toHaveLength(1);
  });

  // Quien no tiene plaza: sin el trazado y con la salida como una zona
  it('draws only the points, with the zone of an approximate one, without the route', async () => {
    const root = await render(PICKUP, {
      route: { ...ROUTE, geometry: null },
      origin: { ...ORIGIN, isApproximate: true },
    });

    expect(legend(root)).toEqual(['S Salida', 'R Recogida', 'D Destino', 'Zona aproximada']);
    expect(root.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      'Zona aproximada del viaje: Roquetas de Mar a Campus UAL',
    );
    expect(root.querySelectorAll('.trip-route-map__marker')).toHaveLength(3);
    expect(root.querySelectorAll('.trip-route-map__zone')).toHaveLength(1);
  });

  it('stops watching the size when it is destroyed', async () => {
    await render();
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
