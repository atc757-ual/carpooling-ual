import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { vi } from 'vitest';
import { LocationConsentService } from './location-consent.service';
import { GEOLOCATION, LocationError, LocationService } from './location.service';

describe('LocationService', () => {
  let location: LocationService;

  const geolocation = {
    getCurrentPosition: vi.fn(),
    requestPermissions: vi.fn(),
    checkPermissions: vi.fn(),
  };
  const consent = { getStatus: vi.fn(), set: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    consent.getStatus.mockResolvedValue('granted');
    consent.set.mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [
        { provide: GEOLOCATION, useValue: geolocation },
        { provide: LocationConsentService, useValue: consent },
      ],
    });
    location = TestBed.inject(LocationService);
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
  });

  afterEach(() => vi.restoreAllMocks());

  const position = (longitude: number, latitude: number) =>
    ({ coords: { longitude, latitude, accuracy: 12 }, timestamp: 0 }) as Awaited<
      ReturnType<typeof Geolocation.getCurrentPosition>
    >;

  it('gives the point of the device as [longitude, latitude]', async () => {
    geolocation.getCurrentPosition.mockResolvedValue(position(-2.46, 36.84));

    await expect(location.getCurrentPoint()).resolves.toEqual([-2.46, 36.84]);
  });

  it('returns the location accuracy for the live map halo', async () => {
    geolocation.getCurrentPosition.mockResolvedValue(position(-2.46, 36.84));

    await expect(location.getCurrentLocation()).resolves.toEqual({
      coordinates: [-2.46, 36.84],
      accuracy: 12,
    });
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

  it('does not use the location without the consent given in the app', async () => {
    consent.getStatus.mockResolvedValue('none');
    await expect(location.checkPermission()).resolves.toBe('prompt');
    await expect(location.getCurrentPoint()).rejects.toEqual(new LocationError('revoked'));

    consent.getStatus.mockResolvedValue('revoked');
    await expect(location.checkPermission()).resolves.toBe('revoked');
    expect(geolocation.checkPermissions).not.toHaveBeenCalled();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('records the withdrawal when the system permission was removed', async () => {
    geolocation.checkPermissions.mockResolvedValueOnce({ location: 'denied' });

    await expect(location.checkPermission()).resolves.toBe('denied');
    expect(consent.set).toHaveBeenCalledWith('revoked', 'device');
  });

  it('knows whether the permission was given, denied or not asked yet', async () => {
    geolocation.checkPermissions.mockResolvedValueOnce({ location: 'granted' });
    await expect(location.checkPermission()).resolves.toBe('granted');

    geolocation.checkPermissions.mockResolvedValueOnce({ location: 'denied' });
    await expect(location.checkPermission()).resolves.toBe('denied');

    geolocation.checkPermissions.mockResolvedValueOnce({ location: 'prompt-with-rationale' });
    await expect(location.checkPermission()).resolves.toBe('prompt');

    geolocation.checkPermissions.mockRejectedValueOnce(new Error('Not supported'));
    await expect(location.checkPermission()).resolves.toBe('prompt');
  });

  it('tells a denied permission from a location that does not come', async () => {
    const get = geolocation.getCurrentPosition;

    get.mockRejectedValueOnce({ code: 1, message: 'User denied Geolocation' });
    await expect(location.getCurrentPoint()).rejects.toMatchObject({ reason: 'denied' });

    get.mockRejectedValueOnce({ code: 3, message: 'Timeout expired' });
    await expect(location.getCurrentPoint()).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
