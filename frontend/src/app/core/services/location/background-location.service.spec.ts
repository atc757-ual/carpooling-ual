import { TestBed } from '@angular/core/testing';
import type { CallbackError, Location } from '@capgo/background-geolocation';
import { vi } from 'vitest';
import { BACKGROUND_GEOLOCATION, BackgroundLocationService } from './background-location.service';

type Callback = (position?: Location, error?: CallbackError) => void;

describe('BackgroundLocationService', () => {
  let start: ReturnType<typeof vi.fn>;
  let stop: ReturnType<typeof vi.fn>;
  let callback: Callback;
  let service: BackgroundLocationService;

  beforeEach(() => {
    start = vi.fn().mockImplementation((_options, onLocation: Callback) => {
      callback = onLocation;
      return Promise.resolve();
    });
    stop = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: BACKGROUND_GEOLOCATION, useValue: { start, stop } }],
    });
    service = TestBed.inject(BackgroundLocationService);
  });

  it('starts with the notification that says the location is being shared', async () => {
    await expect(service.start(vi.fn())).resolves.toBe(true);

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundTitle: 'Compartiendo tu ubicación',
        backgroundMessage: 'Tus pasajeros ven dónde estás hasta que termines el viaje.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10,
      }),
      expect.any(Function),
    );
  });

  it('gives each position as [longitude, latitude] and skips the errors', async () => {
    const onPoint = vi.fn();
    await service.start(onPoint);

    callback({ longitude: -2.41, latitude: 36.82 } as Location);
    callback(undefined, { code: 'NOT_AUTHORIZED' } as CallbackError);

    expect(onPoint).toHaveBeenCalledTimes(1);
    expect(onPoint).toHaveBeenCalledWith([-2.41, 36.82]);
  });

  it('says so when it cannot start and stops quietly', async () => {
    start.mockRejectedValue(new Error('no permission'));
    await expect(service.start(vi.fn())).resolves.toBe(false);

    stop.mockRejectedValue(new Error('not started'));
    await expect(service.stop()).resolves.toBeUndefined();
  });
});
