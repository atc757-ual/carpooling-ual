import type * as Leaflet from 'leaflet';
import { vi } from 'vitest';
import { GeoPoint } from '../../../../core/models/place.model';
import { TripPosition } from '../../../../core/models/trip-position.model';
import { CurrentLocation } from '../../../../core/services/location/location.service';
import { LiveTripMapRenderer } from './live-trip-map-renderer';

const CENTER: GeoPoint = { type: 'Point', coordinates: [-2.46, 36.84] };
const PICKUP: GeoPoint = { type: 'Point', coordinates: [-2.45, 36.84] };
const POSITION: TripPosition = {
  tripId: 't1',
  position: { type: 'Point', coordinates: [-2.46, 36.84] },
  recordedAt: '2026-11-01T20:00:00.000Z',
  remainingKm: 1,
  remainingMin: 2,
  remainingSource: 'estimated',
  estimatedArrivalAt: '2026-11-01T20:02:00.000Z',
};
const PASSENGER: CurrentLocation = { coordinates: [-2.44, 36.84], accuracy: 12 };

describe('LiveTripMapRenderer', () => {
  const map = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
  };
  const marker = {
    addTo: vi.fn(),
    remove: vi.fn(),
    setLatLng: vi.fn(),
    getLatLng: vi.fn(() => ({ lat: 36.84, lng: -2.46 })),
  };
  const accuracyCircle = {
    addTo: vi.fn(),
    remove: vi.fn(),
    setLatLng: vi.fn().mockReturnThis(),
    setRadius: vi.fn(),
  };
  const passengerMarker = {
    addTo: vi.fn(),
    remove: vi.fn(),
    setLatLng: vi.fn(),
  };
  const resizeObserver = { observe: vi.fn(), disconnect: vi.fn() };
  const leaflet = {
    map: vi.fn(),
    tileLayer: vi.fn(),
    marker: vi.fn(),
    divIcon: vi.fn(),
    circle: vi.fn(),
    circleMarker: vi.fn(),
    latLngBounds: vi.fn(),
  };
  let renderer: LiveTripMapRenderer;
  let element: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    map.setView.mockReturnValue(map);
    leaflet.map.mockReturnValue(map);
    leaflet.tileLayer.mockReturnValue({ addTo: vi.fn() });
    marker.addTo.mockReturnThis();
    leaflet.marker.mockReturnValue(marker);
    leaflet.divIcon.mockReturnValue({});
    accuracyCircle.addTo.mockReturnThis();
    leaflet.circle.mockReturnValue(accuracyCircle);
    passengerMarker.addTo.mockReturnThis();
    leaflet.circleMarker.mockReturnValue(passengerMarker);
    leaflet.latLngBounds.mockReturnValue({});
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = resizeObserver.observe;
        disconnect = resizeObserver.disconnect;
      },
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(performance.now() + 1_500);
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    renderer = new LiveTripMapRenderer(leaflet as unknown as typeof Leaflet);
    element = document.createElement('div');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('initializes the OSM map and observes its container size', () => {
    renderer.initialize(element, CENTER);

    expect(leaflet.map).toHaveBeenCalledWith(element, {
      scrollWheelZoom: false,
      zoomControl: false,
    });
    expect(leaflet.tileLayer).toHaveBeenCalledWith(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(resizeObserver.observe).toHaveBeenCalledWith(element);
  });

  it('draws the car, pickup and passenger, animates updates and centers once', () => {
    renderer.initialize(element, CENTER);
    renderer.render(POSITION, PASSENGER, PICKUP, 'Recogida', CENTER, true);

    expect(leaflet.marker).toHaveBeenCalledTimes(2);
    expect(leaflet.circle).toHaveBeenCalledOnce();
    expect(leaflet.circleMarker).toHaveBeenCalledOnce();
    expect(map.fitBounds).toHaveBeenCalledOnce();

    const updatedPosition = {
      ...POSITION,
      position: { type: 'Point' as const, coordinates: [-2.459, 36.84] as [number, number] },
    };
    renderer.render(updatedPosition, PASSENGER, PICKUP, 'Recogida', CENTER, true);

    expect(marker.setLatLng).toHaveBeenCalled();
    expect(accuracyCircle.setLatLng).toHaveBeenCalled();
    expect(passengerMarker.setLatLng).toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });

  it('removes the passenger marker when the passenger is already in the car', () => {
    const nearby = { ...PASSENGER, coordinates: [-2.4601, 36.84] as [number, number] };
    renderer.initialize(element, CENTER);
    renderer.render(POSITION, nearby, PICKUP, 'Recogida', CENTER, true);

    expect(leaflet.circle).not.toHaveBeenCalled();
    expect(leaflet.circleMarker).not.toHaveBeenCalled();
  });

  it('uses a single point when centering without a position or pickup', () => {
    renderer.initialize(element, CENTER);
    renderer.center(null, null, null, CENTER);

    expect(map.setView).toHaveBeenLastCalledWith([36.84, -2.46], 15);
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('removes the pickup and cleans up map resources', () => {
    renderer.initialize(element, CENTER);
    renderer.render(POSITION, null, PICKUP, 'Recogida', CENTER, false);
    renderer.render(POSITION, null, null, 'Recogida', CENTER, false);
    renderer.render(
      {
        ...POSITION,
        position: { type: 'Point', coordinates: [-2.459, 36.84] },
      },
      null,
      null,
      'Recogida',
      CENTER,
      false,
    );
    renderer.destroy();

    expect(marker.remove).toHaveBeenCalledOnce();
    expect(resizeObserver.disconnect).toHaveBeenCalledOnce();
    expect(map.remove).toHaveBeenCalledOnce();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
