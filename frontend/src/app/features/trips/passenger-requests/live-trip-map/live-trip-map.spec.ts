import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { GeoPoint } from '../../../../core/models/place.model';
import { TripPosition } from '../../../../core/models/trip-position.model';
import { CurrentLocation } from '../../../../core/services/location/location.service';
import { LocationService } from '../../../../core/services/location/location.service';
import { TrackingService } from '../../../../core/services/tracking/tracking.service';
import { LiveTripMap } from './live-trip-map';
import { LIVE_TRIP_MAP_RENDERER_FACTORY, LOAD_LEAFLET } from './live-trip-map-runtime';

const renderer = {
  initialize: vi.fn(),
  render: vi.fn(),
  center: vi.fn(),
  destroy: vi.fn(),
};

const CENTER: GeoPoint = { type: 'Point', coordinates: [-2.46, 36.84] };
const PICKUP: GeoPoint = { type: 'Point', coordinates: [-2.45, 36.84] };

function tripPosition(recordedAt = new Date().toISOString()): TripPosition {
  return {
    tripId: 't1',
    position: { type: 'Point', coordinates: [-2.46, 36.84] },
    recordedAt,
    remainingKm: 1,
    remainingMin: 2,
    remainingSource: 'estimated',
    estimatedArrivalAt: new Date(Date.now() + 120_000).toISOString(),
  };
}

describe('LiveTripMap', () => {
  let fixture: ComponentFixture<LiveTripMap>;
  let tracking: { getLatest: ReturnType<typeof vi.fn> };
  let location: {
    checkPermission: ReturnType<typeof vi.fn>;
    getCurrentLocation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tracking = { getLatest: vi.fn().mockResolvedValue(tripPosition()) };
    location = {
      checkPermission: vi.fn().mockResolvedValue('prompt'),
      getCurrentLocation: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [LiveTripMap],
      providers: [
        provideIonicAngular(),
        { provide: TrackingService, useValue: tracking },
        { provide: LocationService, useValue: location },
        { provide: LOAD_LEAFLET, useValue: vi.fn().mockResolvedValue({}) },
        { provide: LIVE_TRIP_MAP_RENDERER_FACTORY, useValue: () => renderer },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render(
    active = true,
    inputs: Record<string, unknown> = { pickupLocation: PICKUP },
  ): Promise<HTMLElement> {
    fixture = TestBed.createComponent(LiveTripMap);
    fixture.componentRef.setInput('tripId', 't1');
    fixture.componentRef.setInput('initialCenter', CENTER);
    fixture.componentRef.setInput('active', active);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    for (
      let attempt = 0;
      attempt < 10 && !fixture.componentInstance.locationResolved();
      attempt++
    ) {
      await Promise.resolve();
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('polls immediately and then every ten seconds', async () => {
    vi.useFakeTimers();
    await render();
    await vi.advanceTimersByTimeAsync(0);
    expect(tracking.getLatest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(tracking.getLatest).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(tracking.getLatest).toHaveBeenCalledTimes(2);
  });

  it('stops polling when the page becomes inactive', async () => {
    vi.useFakeTimers();
    await render();
    await vi.advanceTimersByTimeAsync(0);
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    await fixture.whenStable();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(tracking.getLatest).toHaveBeenCalledTimes(1);
  });

  it('stops polling while the app is in the background', async () => {
    vi.useFakeTimers();
    await render();
    await vi.advanceTimersByTimeAsync(0);
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    try {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      fixture.detectChanges();
      await fixture.whenStable();

      await vi.advanceTimersByTimeAsync(20_000);

      expect(tracking.getLatest).toHaveBeenCalledTimes(1);
    } finally {
      if (visibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });

  it('does not request device location when permission or consent is missing', async () => {
    const root = await render();

    expect(location.checkPermission).toHaveBeenCalled();
    expect(location.getCurrentLocation).not.toHaveBeenCalled();
    expect(root.textContent).toContain('No podemos mostrar tu ubicación');
  });

  it('shows the together state when the passenger is within thirty meters', async () => {
    const nearby: CurrentLocation = {
      coordinates: [-2.4601, 36.84],
      accuracy: 8,
    };
    location.checkPermission.mockResolvedValue('granted');
    location.getCurrentLocation.mockResolvedValue(nearby);
    const root = await render();

    expect(fixture.componentInstance.isTogether()).toBe(true);
    expect(root.textContent).toContain('Estás en el coche.');
  });

  it('warns when the most recent position is over one minute old', async () => {
    const stale = new Date(Date.now() - 61_000).toISOString();
    tracking.getLatest.mockResolvedValue(tripPosition(stale));
    const root = await render();

    expect(fixture.componentInstance.isStale()).toBe(true);
    expect(root.textContent).toContain('Sin posición reciente del coche.');
  });

  it('names the driver when telling the passenger the pickup time', async () => {
    const root = await render(true, { pickupLocation: PICKUP, driverName: 'Carlos' });

    expect(root.textContent).toMatch(/Carlos llega en ~\d+ min a tu punto de recogida/);
  });

  describe('as the driver', () => {
    it('shows the time to the next pickup without asking for the location', async () => {
      const root = await render(true, {
        viewer: 'driver',
        pickupLocation: PICKUP,
        pickupName: 'Av. del Mediterráneo',
      });

      expect(location.checkPermission).not.toHaveBeenCalled();
      expect(root.textContent).toMatch(/Llegas en ~\d+ min a Av\. del Mediterráneo/);
      expect(root.textContent).not.toContain('No podemos mostrar tu ubicación');
      expect(fixture.componentInstance.mapLabel()).toBe('Tu posición y Av. del Mediterráneo');
    });

    it('shows the time to the destination when there is no pickup left', async () => {
      const root = await render(true, { viewer: 'driver' });

      expect(root.textContent).toContain('Llegas al destino en ~2 min.');
    });

    it('waits for the first position and warns when it stops arriving', async () => {
      tracking.getLatest.mockRejectedValueOnce(new Error('down'));
      const waiting = await render(true, { viewer: 'driver' });
      expect(waiting.textContent).toContain('Esperando tu primera ubicación…');
      fixture.destroy();

      tracking.getLatest.mockResolvedValue(
        tripPosition(new Date(Date.now() - 61_000).toISOString()),
      );
      const stale = await render(true, { viewer: 'driver' });

      expect(stale.textContent).toContain('No estamos recibiendo tu ubicación.');
    });
  });

  it('destroys the map renderer with the screen', async () => {
    await render();

    fixture.destroy();

    expect(renderer.destroy).toHaveBeenCalledOnce();
  });
});
