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

// Un punto del mapa: GeoJSON ([longitud, latitud]) y su nombre
export interface RoutePoint {
  coordinates: [number, number];
  label: string;
}

interface RouteMarker {
  point: RoutePoint;
  letter: string;
  modifier: string;
}

// Mapa de la ruta del conductor y, si se indica, del punto de recogida del
// pasajero (en el panel, sin recogida). El alto lo fija quien lo usa con
// --trip-route-map-height
@Component({
  selector: 'app-trip-route-map',
  template: `
    <div #map class="trip-route-map__canvas" role="img" [attr.aria-label]="label()"></div>
    <p class="trip-route-map__legend text-caption text-color-muted" aria-hidden="true">
      <span class="trip-route-map__legend-item"><b>S</b> Salida</span>
      @if (pickup()) {
        <span class="trip-route-map__legend-item"><b>R</b> Recogida</span>
      }
      <span class="trip-route-map__legend-item"><b>D</b> Destino</span>
    </p>
  `,
  styleUrl: './trip-route-map.scss',
})
export class TripRouteMap implements OnDestroy {
  readonly route = input.required<TripRoute>();
  readonly origin = input.required<RoutePoint>();
  readonly pickup = input<RoutePoint | null>(null);
  readonly destination = input.required<RoutePoint>();

  protected readonly label = computed(() => {
    const route = `Ruta del conductor: ${this.origin().label} a ${this.destination().label}`;
    const pickup = this.pickup();
    return pickup ? `${route}; recogida en ${pickup.label}` : route;
  });
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private map: Leaflet.Map | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const element = this.mapElement()?.nativeElement;
      const route = this.route();
      const markers = this.markers();
      if (element && !this.map) {
        void this.createMap(element, route, markers);
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  // Salida, recogida (si la hay) y destino, con su letra y su color
  private markers(): RouteMarker[] {
    const pickup = this.pickup();
    return [
      { point: this.origin(), letter: 'S', modifier: 'trip-route-map__marker--origin' },
      ...(pickup
        ? [{ point: pickup, letter: 'R', modifier: 'trip-route-map__marker--pickup' }]
        : []),
      { point: this.destination(), letter: 'D', modifier: 'trip-route-map__marker--destination' },
    ];
  }

  private async createMap(
    element: HTMLElement,
    route: TripRoute,
    markers: RouteMarker[],
  ): Promise<void> {
    const leafletModule = (await import('leaflet')) as typeof Leaflet & {
      default?: typeof Leaflet;
    };
    const leaflet = leafletModule.default ?? leafletModule;
    const map = leaflet.map(element, {
      dragging: false,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false,
    });
    this.map = map;
    leaflet.tileLayer(TILES_URL, { maxZoom: 19, attribution: TILES_ATTRIBUTION }).addTo(map);
    const routePoints = route.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number],
    );
    leaflet.polyline(routePoints, { color: 'var(--color-link)', weight: 5 }).addTo(map);
    const bounds = leaflet.latLngBounds(routePoints);
    for (const marker of markers) {
      this.addMarker(leaflet, map, marker);
      bounds.extend([marker.point.coordinates[1], marker.point.coordinates[0]]);
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(element);
    }
  }

  private addMarker(
    leaflet: typeof Leaflet,
    map: Leaflet.Map,
    { point, letter, modifier }: RouteMarker,
  ): void {
    const [lon, lat] = point.coordinates;
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
      .addTo(map);
  }
}
