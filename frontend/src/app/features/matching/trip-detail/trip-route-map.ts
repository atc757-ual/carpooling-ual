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
import { TripRoute } from '../../../core/models/trip-route.model';

const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MARKER_SIZE = 28;

// Mapa de la ruta del conductor y del punto de recogida del pasajero
@Component({
  selector: 'app-trip-route-map',
  template: `
    <div #map class="trip-route-map__canvas" role="img" [attr.aria-label]="label()"></div>
    <p class="trip-route-map__legend text-caption text-color-muted" aria-hidden="true">
      <span class="trip-route-map__legend-item"><b>S</b> Salida</span>
      <span class="trip-route-map__legend-item"><b>R</b> Recogida</span>
      <span class="trip-route-map__legend-item"><b>D</b> Destino</span>
    </p>
  `,
  styleUrl: './trip-route-map.scss',
})
export class TripRouteMap implements OnDestroy {
  readonly route = input.required<TripRoute>();
  readonly origin = input.required<{ coordinates: [number, number]; label: string }>();
  readonly pickup = input.required<{ coordinates: [number, number]; label: string }>();
  readonly destination = input.required<{ coordinates: [number, number]; label: string }>();

  protected readonly label = computed(
    () =>
      `Ruta del conductor: ${this.origin().label} a ${this.destination().label}; recogida en ${this.pickup().label}`,
  );
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private map: Leaflet.Map | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const element = this.mapElement()?.nativeElement;
      const route = this.route();
      const origin = this.origin();
      const pickup = this.pickup();
      const destination = this.destination();
      if (element && !this.map) {
        void this.createMap(element, route, origin, pickup, destination);
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  private async createMap(
    element: HTMLElement,
    route: TripRoute,
    origin: { coordinates: [number, number]; label: string },
    pickup: { coordinates: [number, number]; label: string },
    destination: { coordinates: [number, number]; label: string },
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
    this.addMarker(
      leaflet,
      map,
      origin.coordinates,
      origin.label,
      'S',
      'trip-route-map__marker--origin',
    );
    this.addMarker(
      leaflet,
      map,
      pickup.coordinates,
      pickup.label,
      'R',
      'trip-route-map__marker--pickup',
    );
    this.addMarker(
      leaflet,
      map,
      destination.coordinates,
      destination.label,
      'D',
      'trip-route-map__marker--destination',
    );
    const bounds = leaflet.latLngBounds(routePoints);
    bounds.extend([pickup.coordinates[1], pickup.coordinates[0]]);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(element);
    }
  }

  private addMarker(
    leaflet: typeof Leaflet,
    map: Leaflet.Map,
    [lon, lat]: [number, number],
    title: string,
    letter: string,
    modifier: string,
  ): void {
    leaflet
      .marker([lat, lon], {
        title,
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
