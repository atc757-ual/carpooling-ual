import {
  Component,
  computed,
  ElementRef,
  effect,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { TripRoute } from '../../../../core/models/trip-route.model';

const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MARKER_SIZE = 28;
// Radio del círculo de la zona en que está un punto aproximado (el servidor
// lo redondea a una cuadrícula de unos 500 m)
const APPROXIMATE_RADIUS_METERS = 300;

// Un punto del mapa: GeoJSON ([longitud, latitud]) y su nombre. Aproximado:
// se pinta con la zona alrededor (quien no tiene plaza no ve el exacto)
export interface RoutePoint {
  coordinates: [number, number];
  label: string;
  isApproximate?: boolean;
}

interface RouteMarker {
  point: RoutePoint;
  letter: string;
  modifier: string;
}

// Mapa de la ruta del conductor y, si se indican, de los puntos de recogida
// (el del pasajero en su solicitud; los de los aceptados en el viaje del
// conductor; en el panel, ninguno). Sin trazado (quien no tiene plaza), solo
// los puntos. El alto lo fija quien lo usa con --trip-route-map-height
@Component({
  selector: 'app-trip-route-map',
  template: `
    <div #map class="trip-route-map__canvas" role="img" [attr.aria-label]="label()"></div>
    <p class="trip-route-map__legend text-caption text-color-muted" aria-hidden="true">
      <span class="trip-route-map__legend-item"><b>S</b> Salida</span>
      @if (pickups().length > 0) {
        <span class="trip-route-map__legend-item"><b>R</b> Recogida</span>
      }
      <span class="trip-route-map__legend-item"><b>D</b> Destino</span>
      @if (hasApproximatePoints()) {
        <span class="trip-route-map__legend-item">Zona aproximada</span>
      }
    </p>
  `,
  styleUrl: './trip-route-map.scss',
})
export class TripRouteMap implements OnDestroy {
  readonly route = input.required<TripRoute>();
  readonly origin = input.required<RoutePoint>();
  readonly pickups = input<RoutePoint[]>([]);
  readonly destination = input.required<RoutePoint>();

  protected readonly hasApproximatePoints = computed(
    () => this.origin().isApproximate === true || this.destination().isApproximate === true,
  );
  protected readonly label = computed(() => {
    const ends = `${this.origin().label} a ${this.destination().label}`;
    const route = this.hasApproximatePoints()
      ? `Zona aproximada del viaje: ${ends}`
      : `Ruta del conductor: ${ends}`;
    const pickups = this.pickups().map(({ label }) => label);
    return pickups.length > 0 ? `${route}; recogida en ${pickups.join(', ')}` : route;
  });
  // Salida, recogidas y destino, con su letra y su color
  private readonly markers = computed<RouteMarker[]>(() => [
    { point: this.origin(), letter: 'S', modifier: 'trip-route-map__marker--origin' },
    ...this.pickups().map((point) => ({
      point,
      letter: 'R',
      modifier: 'trip-route-map__marker--pickup',
    })),
    { point: this.destination(), letter: 'D', modifier: 'trip-route-map__marker--destination' },
  ]);
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private leaflet: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private routeLayer: Leaflet.Polyline | null = null;
  private markerLayer: Leaflet.LayerGroup | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isInitializing = false;
  private isDestroyed = false;

  constructor() {
    effect(() => {
      const element = this.mapElement()?.nativeElement;
      const route = this.route();
      const markers = this.markers();
      if (!element || this.isDestroyed) {
        return;
      }
      if (this.map) {
        // Cambian la ruta o las recogidas: se actualizan sobre el mapa existente
        this.updateRoute(route);
        this.drawMarkers(markers);
      } else if (!this.isInitializing) {
        this.isInitializing = true;
        void this.createMap(element, route, markers).finally(() => {
          this.isInitializing = false;
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.resizeObserver?.disconnect();
    this.routeLayer?.remove();
    this.routeLayer = null;
    this.markerLayer?.remove();
    this.markerLayer = null;
    this.map?.remove();
    this.map = null;
    const element = this.mapElement()?.nativeElement;
    if (element && (element as unknown as { _leaflet_id?: number })._leaflet_id) {
      delete (element as unknown as { _leaflet_id?: number })._leaflet_id;
    }
  }

  private async createMap(
    element: HTMLElement,
    route: TripRoute,
    markers: RouteMarker[],
  ): Promise<void> {
    const leafletModule = (await import('leaflet')) as typeof Leaflet & {
      default?: typeof Leaflet;
    };
    if (this.isDestroyed || this.map) {
      return;
    }
    const leaflet = leafletModule.default ?? leafletModule;
    this.leaflet = leaflet;

    const el = element as unknown as { _leaflet_id?: number };
    if (el._leaflet_id) {
      delete el._leaflet_id;
    }

    // Se puede acercar para ver mejor: botones + y −, pellizcar, doble clic y
    // teclado. Sin rueda, para no secuestrar el scroll de la pantalla. En el
    // móvil, arrastrar solo tras acercar: con el zoom inicial, un dedo sobre
    // el mapa sigue desplazando la pantalla
    const isMobile = leaflet.Browser.mobile;
    const map = leaflet.map(element, {
      dragging: !isMobile,
      scrollWheelZoom: false,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: true,
      zoomControl: true,
    });
    this.map = map;
    leaflet.tileLayer(TILES_URL, { maxZoom: 19, attribution: TILES_ATTRIBUTION }).addTo(map);
    this.updateRoute(route);
    this.markerLayer = leaflet.layerGroup().addTo(map);
    this.drawMarkers(markers);
    const routePoints = (route.geometry?.coordinates ?? []).map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
    const bounds = leaflet.latLngBounds(routePoints);
    for (const { point } of markers) {
      const [lon, lat] = point.coordinates;
      bounds.extend([lat, lon]);
      if (point.isApproximate) {
        // La zona entera a la vista, no solo su centro
        bounds.extend(leaflet.latLng(lat, lon).toBounds(APPROXIMATE_RADIUS_METERS * 2));
      }
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    if (isMobile) {
      const initialZoom = map.getZoom();
      map.on('zoomend', () => {
        if (map.getZoom() > initialZoom) {
          map.dragging.enable();
        } else {
          map.dragging.disable();
        }
      });
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(element);
    }
  }

  private updateRoute(route: TripRoute): void {
    const { leaflet, map } = this;
    if (!leaflet || !map) {
      return;
    }
    if (this.routeLayer) {
      this.routeLayer.remove();
      this.routeLayer = null;
    }
    const routePoints = (route.geometry?.coordinates ?? []).map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
    if (routePoints.length > 0) {
      this.routeLayer = leaflet
        .polyline(routePoints, { color: 'var(--color-link)', weight: 5 })
        .addTo(map);
    }
  }

  private drawMarkers(markers: RouteMarker[]): void {
    const { leaflet, markerLayer } = this;
    if (!leaflet || !markerLayer) {
      return;
    }
    markerLayer.clearLayers();
    for (const marker of markers) {
      this.addMarker(leaflet, markerLayer, marker);
    }
  }

  private addMarker(
    leaflet: typeof Leaflet,
    layer: Leaflet.LayerGroup,
    { point, letter, modifier }: RouteMarker,
  ): void {
    const [lon, lat] = point.coordinates;
    if (point.isApproximate) {
      leaflet
        .circle([lat, lon], {
          radius: APPROXIMATE_RADIUS_METERS,
          className: 'trip-route-map__zone',
          interactive: false,
        })
        .addTo(layer);
    }
    leaflet
      .marker([lat, lon], {
        title: point.label,
        icon: leaflet.divIcon({
          html: `<span aria-hidden="true">${letter}</span>`,
          className: `trip-route-map__marker ${modifier}`,
          iconSize: [MARKER_SIZE, MARKER_SIZE],
          iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
        }),
      })
      .addTo(layer);
  }
}
