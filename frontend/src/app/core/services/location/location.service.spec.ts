import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { vi } from 'vitest';
import { GEOLOCATION, LocationError, LocationService } from './location.service';

describe('LocationService', () => {
  let location: LocationService;

  const geolocation = { getCurrentPosition: vi.fn(), requestPermissions: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: GEOLOCATION, useValue: geolocation }],
    });
    location = TestBed.inject(LocationService);
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
  });

  afterEach(() => vi.restoreAllMocks());

  const position = (longitude: number, latitude: number) =>
    ({ coords: { longitude, latitude }, timestamp: 0 }) as Awaited<
      ReturnType<typeof Geolocation.getCurrentPosition>
    >;

  it('gives the point of the device as [longitude, latitude]', async () => {
    geolocation.getCurrentPosition.mockResolvedValue(position(-2.46, 36.84));

    await expect(location.getCurrentPoint()).resolves.toEqual([-2.46, 36.84]);
  });

  it('asks for the permission in the app, and fails without it', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    geolocation.requestPermissions.mockResolvedValue({
      location: 'denied',
      coarseLocation: 'denied',
    });

    await expect(location.getCurrentPoint()).rejects.toEqual(new LocationError('denied'));
    expect(geolocation.requestPermissions).toHaveBeenCalled();
  });

  it('tells a denied permission from a location that does not come', async () => {
    const get = geolocation.getCurrentPosition;

    get.mockRejectedValueOnce({ code: 1, message: 'User denied Geolocation' });
    await expect(location.getCurrentPoint()).rejects.toMatchObject({ reason: 'denied' });

    get.mockRejectedValueOnce({ code: 3, message: 'Timeout expired' });
    await expect(location.getCurrentPoint()).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
