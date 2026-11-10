import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { vi } from 'vitest';
import { BackgroundLocationService } from './background-location.service';
import { LocationConsentService } from './location-consent.service';
import { ToastService } from '../ui/toast.service';
import { GEOLOCATION, LocationError, LocationService } from './location.service';

describe('LocationService', () => {
  let location: LocationService;

  const geolocation = {
    getCurrentPosition: vi.fn(),
    requestPermissions: vi.fn(),
    checkPermissions: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
  const consent = { getStatus: vi.fn(), set: vi.fn() };
  const background = { start: vi.fn(), stop: vi.fn() };
  const toast = { showError: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    consent.getStatus.mockResolvedValue('granted');
    consent.set.mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [
        { provide: GEOLOCATION, useValue: geolocation },
        { provide: LocationConsentService, useValue: consent },
        { provide: BackgroundLocationService, useValue: background },
        { provide: ToastService, useValue: toast },
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

  it('follows the position as [longitude, latitude] and stops following it', async () => {
    geolocation.watchPosition.mockImplementation((_options, callback) => {
      callback(position(-2.46, 36.84));
      callback(null);
      return Promise.resolve('w1');
    });
    geolocation.clearWatch.mockResolvedValue(undefined);
    const points: [number, number][] = [];

    await expect(location.watchPoint((point) => points.push(point))).resolves.toBe('w1');
    await location.clearWatch('w1');

    expect(points).toEqual([[-2.46, 36.84]]);
    expect(geolocation.clearWatch).toHaveBeenCalledWith({ id: 'w1' });
  });

  it('follows the position in the background in the native app', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    background.start.mockResolvedValue(true);
    background.stop.mockResolvedValue(undefined);
    const onPoint = vi.fn();

    await expect(location.watchPoint(onPoint)).resolves.toBe('background');
    expect(background.start).toHaveBeenCalledWith(onPoint);
    expect(geolocation.watchPosition).not.toHaveBeenCalled();

    await location.clearWatch('background');
    expect(background.stop).toHaveBeenCalled();
    expect(geolocation.clearWatch).not.toHaveBeenCalled();

    background.start.mockResolvedValue(false);
    await expect(location.watchPoint(onPoint)).resolves.toBeNull();
  });

  it('does not follow the position without consent or when the device fails', async () => {
    consent.getStatus.mockResolvedValue('revoked');
    await expect(location.watchPoint(vi.fn())).resolves.toBeNull();
    expect(geolocation.watchPosition).not.toHaveBeenCalled();

    consent.getStatus.mockResolvedValue('granted');
    geolocation.watchPosition.mockRejectedValue(new Error('not available'));
    await expect(location.watchPoint(vi.fn())).resolves.toBeNull();

    geolocation.clearWatch.mockRejectedValue(new Error('gone'));
    await expect(location.clearWatch('w1')).resolves.toBeUndefined();
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

  // RGPD 6.1.b: la del conductor con su viaje en curso es parte del servicio
  it('uses the location of a driver in a trip without the consent, only with the device permission', async () => {
    consent.getStatus.mockResolvedValue('revoked');
    geolocation.getCurrentPosition.mockResolvedValue(position(-2.46, 36.84));
    geolocation.watchPosition.mockResolvedValue('w1');

    await expect(location.getCurrentPoint('driving')).resolves.toEqual([-2.46, 36.84]);
    await expect(location.watchPoint(vi.fn(), 'driving')).resolves.toBe('w1');
    expect(consent.set).not.toHaveBeenCalled();
  });

  it('records the withdrawal when the system permission was removed', async () => {
    geolocation.checkPermissions.mockResolvedValueOnce({ location: 'denied' });

    await expect(location.checkPermission()).resolves.toBe('denied');
    expect(consent.set).toHaveBeenCalledWith('revoked', 'device');
    expect(toast.showError).not.toHaveBeenCalled();
  });

  it('warns with a toast when the withdrawal cannot be recorded', async () => {
    geolocation.checkPermissions.mockResolvedValueOnce({ location: 'denied' });
    consent.set.mockRejectedValue(new Error('offline'));

    await expect(location.checkPermission()).resolves.toBe('denied');
    expect(toast.showError).toHaveBeenCalledWith(
      'No hemos podido guardar que has quitado el permiso de ubicación. Lo intentaremos de nuevo.',
    );
  });

  // El permiso del dispositivo (Perfil → Ajustes) no depende del consentimiento
  it('asks for the device permission without the consent of the app', async () => {
    consent.getStatus.mockResolvedValue('revoked');
    geolocation.getCurrentPosition.mockResolvedValue(position(-2.46, 36.84));
    geolocation.checkPermissions.mockResolvedValue({ location: 'granted' });

    await expect(location.requestDevicePermission()).resolves.toBe('granted');
    expect(consent.set).not.toHaveBeenCalled();
  });

  it('fails to ask for the device permission when the user denies it', async () => {
    geolocation.getCurrentPosition.mockRejectedValue({ code: 1 });

    await expect(location.requestDevicePermission()).rejects.toEqual(new LocationError('denied'));
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
