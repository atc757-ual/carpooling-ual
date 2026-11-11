import type * as Leaflet from 'leaflet';
import { CurrentLocation } from '../../../../core/services/location/location.service';
import { GeoPoint } from '../../../../core/models/place.model';
import { TripPosition } from '../../../../core/models/trip-position.model';
import { areTogether, interpolateLatLng, shouldRenderPassengerMarker } from './live-trip-map.utils';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CAR_MARKER_SIZE = 40;
const CAR_ICON_HTML =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11l1.5-4.5A2.2 2.2 0 0 1 8.6 5h6.8a2.2 2.2 0 0 1 2.1 1.5L19 11l1.2 1.3c.5.5.8 1.2.8 1.9V18h-2v-1H5v1H3v-3.8c0-.7.3-1.4.8-1.9L5 11zm1.6 0h10.8l-1.3-3.9a.8.8 0 0 0-.7-.5H8.6a.8.8 0 0 0-.7.5L6.6 11zM6 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm12 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>';

export class LiveTripMapRenderer {
  private map: Leaflet.Map | null = null;
  private carMarker: Leaflet.Marker | null = null;
  private passengerMarker: Leaflet.CircleMarker | null = null;
  private accuracyCircle: Leaflet.Circle | null = null;
  private pickupMarker: Leaflet.Marker | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationFrame: number | null = null;
  private hasInitialBounds = false;
  private bottomInset = 0;

  constructor(private readonly leaflet: typeof Leaflet) {}

  initialize(element: HTMLElement, center: GeoPoint): void {
    const [longitude, latitude] = center.coordinates;
    this.map = this.leaflet
      .map(element, { scrollWheelZoom: false, zoomControl: false })
      .setView([latitude, longitude], 14);
    this.leaflet
      .tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION })
      .addTo(this.map);
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(element);
  }

  render(
    position: TripPosition | null,
    user: CurrentLocation | null,
    pickup: GeoPoint | null,
    pickupName: string,
    fallbackCenter: GeoPoint,
    locationResolved: boolean,
  ): void {
    const map = this.map;
    if (!map) return;
    this.renderPickup(pickup, pickupName);
    if (position) this.renderCar(position);
    this.renderPassenger(position, user);
    if (position && locationResolved && !this.hasInitialBounds) {
      this.center(position, user, pickup, fallbackCenter);
      this.hasInitialBounds = true;
    }
  }

  center(
    position: TripPosition | null,
    user: CurrentLocation | null,
    pickup: GeoPoint | null,
    fallbackCenter: GeoPoint,
  ): void {
    if (!this.map) return;
    const points: Leaflet.LatLngExpression[] = [];
    if (position) points.push(this.toLatLng(position.position));
    if (user && (!position || !areTogether(position.position.coordinates, user.coordinates))) {
      points.push([user.coordinates[1], user.coordinates[0]]);
    }
    points.push(this.toLatLng(pickup ?? fallbackCenter));
    // Con un solo punto, los límites son ese punto y se acerca hasta maxZoom.
    // Por abajo, además, lo que tape la hoja de detalles del móvil
    this.map.fitBounds(this.leaflet.latLngBounds(points), {
      paddingTopLeft: [28, 28],
      paddingBottomRight: [28, 28 + this.bottomInset],
      maxZoom: 15,
    });
  }

  setBottomInset(pixels: number): void {
    this.bottomInset = Math.max(0, pixels);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.map?.remove();
    this.map = null;
  }

  private renderPickup(pickup: GeoPoint | null, name: string): void {
    if (!pickup || !this.map) {
      this.pickupMarker?.remove();
      this.pickupMarker = null;
      return;
    }
    const point = this.toLatLng(pickup);
    if (!this.pickupMarker) {
      this.pickupMarker = this.leaflet
        .marker(point, {
          title: name,
          keyboard: true,
          icon: this.leaflet.divIcon({
            className: 'map-pin',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
        .addTo(this.map);
      return;
    }
    this.pickupMarker.setLatLng(point);
  }

  private renderCar(position: TripPosition): void {
    if (!this.map) return;
    const target = this.toLatLng(position.position);
    if (!this.carMarker) {
      this.carMarker = this.leaflet
        .marker(target, {
          title: 'Posición actual del coche',
          keyboard: true,
          icon: this.leaflet.divIcon({
            html: CAR_ICON_HTML,
            className: 'trip-live-map__car-marker',
            iconSize: [CAR_MARKER_SIZE, CAR_MARKER_SIZE],
            iconAnchor: [CAR_MARKER_SIZE / 2, CAR_MARKER_SIZE / 2],
          }),
        })
        .addTo(this.map);
      return;
    }
    this.animateCar(target);
  }

  private renderPassenger(position: TripPosition | null, user: CurrentLocation | null): void {
    if (
      !this.map ||
      !user ||
      !shouldRenderPassengerMarker(position?.position.coordinates ?? null, user.coordinates)
    ) {
      this.passengerMarker?.remove();
      this.accuracyCircle?.remove();
      this.passengerMarker = null;
      this.accuracyCircle = null;
      return;
    }
    const point: [number, number] = [user.coordinates[1], user.coordinates[0]];
    if (!this.accuracyCircle) {
      this.accuracyCircle = this.leaflet
        .circle(point, {
          radius: Math.max(1, user.accuracy),
          color: 'var(--color-link)',
          fillColor: 'var(--color-link)',
          fillOpacity: 0.16,
          weight: 1,
        })
        .addTo(this.map);
      this.passengerMarker = this.leaflet
        .circleMarker(point, {
          radius: 6,
          color: 'var(--color-surface)',
          weight: 2,
          fillColor: 'var(--color-link)',
          fillOpacity: 1,
        })
        .addTo(this.map);
      return;
    }
    this.accuracyCircle.setLatLng(point).setRadius(Math.max(1, user.accuracy));
    this.passengerMarker?.setLatLng(point);
  }

  private animateCar(target: [number, number]): void {
    const marker = this.carMarker;
    if (!marker) return;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    const current = marker.getLatLng();
    const from: [number, number] = [current.lat, current.lng];
    const started = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - started) / 1_500);
      marker.setLatLng(interpolateLatLng(from, target, progress));
      this.animationFrame = progress < 1 ? requestAnimationFrame(step) : null;
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private toLatLng(point: GeoPoint): [number, number] {
    return [point.coordinates[1], point.coordinates[0]];
  }
}
