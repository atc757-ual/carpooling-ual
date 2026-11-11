import { InjectionToken } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { CurrentLocation } from '../../../../core/services/location/location.service';
import { GeoPoint } from '../../../../core/models/place.model';
import { TripPosition } from '../../../../core/models/trip-position.model';
import { LiveTripMapRenderer } from './live-trip-map-renderer';

export type LeafletModule = typeof Leaflet & { default?: typeof Leaflet };

export interface LiveTripMapRendererPort {
  initialize(element: HTMLElement, center: GeoPoint): void;
  render(
    position: TripPosition | null,
    user: CurrentLocation | null,
    pickup: GeoPoint | null,
    pickupName: string,
    fallbackCenter: GeoPoint,
    locationResolved: boolean,
  ): void;
  center(
    position: TripPosition | null,
    user: CurrentLocation | null,
    pickup: GeoPoint | null,
    fallbackCenter: GeoPoint,
  ): void;
  // Lo que tapa una hoja por abajo (px): al encuadrar, se deja libre
  setBottomInset(pixels: number): void;
  destroy(): void;
}

export const LOAD_LEAFLET = new InjectionToken<() => Promise<LeafletModule>>('LoadLeaflet', {
  providedIn: 'root',
  factory: () => () => import('leaflet') as Promise<LeafletModule>,
});

export const LIVE_TRIP_MAP_RENDERER_FACTORY = new InjectionToken<
  (leaflet: typeof Leaflet) => LiveTripMapRendererPort
>('LiveTripMapRendererFactory', {
  providedIn: 'root',
  factory: () => (leaflet) => new LiveTripMapRenderer(leaflet),
});
