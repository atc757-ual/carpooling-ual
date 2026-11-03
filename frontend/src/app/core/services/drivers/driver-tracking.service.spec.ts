import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { vi } from 'vitest';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { LocationError, LocationService } from '../location/location.service';
import { ScreenWakeLockService } from '../ui/screen-wake-lock.service';
import { DriverService } from './driver.service';
import {
  DriverTrackingService,
  POSITION_INTERVAL_MS,
  SHARING_GAP_MS,
} from './driver-tracking.service';

const POINT: [number, number] = [-2.43, 36.83];

describe('DriverTrackingService', () => {
  const loggedIn = signal(true);
  let isDriver: boolean;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let getCurrentPoint: ReturnType<typeof vi.fn>;
  let watchPoint: ReturnType<typeof vi.fn>;
  let clearWatch: ReturnType<typeof vi.fn>;
  let wakeLock: {
    isActive: ReturnType<typeof signal<boolean>>;
    keepOn: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  let onPoint: (point: [number, number]) => void;
  let tracking: DriverTrackingService;

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    loggedIn.set(true);
    isDriver = true;
    driver = {
      reportPosition: vi.fn().mockResolvedValue(undefined),
      listMyTrips: vi.fn().mockResolvedValue([]),
    };
    getCurrentPoint = vi.fn().mockResolvedValue(POINT);
    watchPoint = vi.fn().mockImplementation((callback: (point: [number, number]) => void) => {
      onPoint = callback;
      return Promise.resolve('w1');
    });
    clearWatch = vi.fn().mockResolvedValue(undefined);
    wakeLock = {
      isActive: signal(false),
      keepOn: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DriverService, useValue: driver },
        { provide: LocationService, useValue: { getCurrentPoint, watchPoint, clearWatch } },
        { provide: ScreenWakeLockService, useValue: wakeLock },
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => loggedIn(), hasProfile: () => isDriver },
        },
      ],
    });
    tracking = TestBed.inject(DriverTrackingService);
  });

  afterEach(() => {
    tracking.stop();
    setVisibility('visible');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sends as the positions arrive, at most every interval', async () => {
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);
    expect(driver['reportPosition']).toHaveBeenCalledTimes(1);

    // Recién enviada: la siguiente posición espera
    onPoint([-2.41, 36.82]);
    await vi.advanceTimersByTimeAsync(0);
    expect(driver['reportPosition']).toHaveBeenCalledTimes(1);

    // En segundo plano los temporizadores no saltan (solo pasa la hora): se
    // envía al llegar la posición
    vi.setSystemTime(Date.now() + POSITION_INTERVAL_MS);
    onPoint([-2.4, 36.81]);
    await vi.advanceTimersByTimeAsync(0);
    expect(driver['reportPosition']).toHaveBeenCalledTimes(2);
    expect(driver['reportPosition']).toHaveBeenLastCalledWith('t1', [-2.4, 36.81]);
  });

  it('does not keep the screen on in the native app', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);

    expect(wakeLock.keepOn).not.toHaveBeenCalled();
    expect(watchPoint).toHaveBeenCalled();
  });

  it('follows the position with the GPS and keeps the screen on until it stops', async () => {
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);
    expect(watchPoint).toHaveBeenCalled();
    expect(wakeLock.keepOn).toHaveBeenCalled();

    onPoint([-2.41, 36.82]);
    await vi.advanceTimersByTimeAsync(POSITION_INTERVAL_MS);
    expect(driver['reportPosition']).toHaveBeenLastCalledWith('t1', [-2.41, 36.82]);
    expect(getCurrentPoint).toHaveBeenCalledTimes(1);

    tracking.stop();
    expect(clearWatch).toHaveBeenCalledWith('w1');
    expect(wakeLock.release).toHaveBeenCalled();
  });

  it('stops following when the trip stopped before the GPS answered', async () => {
    tracking.start('t1');
    tracking.stop();
    await vi.advanceTimersByTimeAsync(0);

    expect(clearWatch).toHaveBeenCalledWith('w1');
  });

  it('sends at once on coming back and warns about the time without sharing', async () => {
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);
    onPoint([-2.41, 36.82]);
    setVisibility('hidden');
    // Con la página oculta, el navegador no deja enviar
    driver['reportPosition'].mockRejectedValue(new Error('frozen'));
    await vi.advanceTimersByTimeAsync(SHARING_GAP_MS * 3);
    driver['reportPosition'].mockResolvedValue(undefined);

    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(tracking.gapMinutes()).toBe(3);
    // Con la posición actual, no la de antes de ocultarse
    expect(driver['reportPosition']).toHaveBeenLastCalledWith('t1', POINT);
    tracking.dismissGap();
    expect(tracking.gapMinutes()).toBeNull();
  });

  it('does not warn after a short time away', async () => {
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(10_000);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);

    expect(tracking.gapMinutes()).toBeNull();
  });

  it('sends the position at once and then every interval', async () => {
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);
    expect(driver['reportPosition']).toHaveBeenCalledWith('t1', POINT);

    await vi.advanceTimersByTimeAsync(POSITION_INTERVAL_MS);

    expect(driver['reportPosition']).toHaveBeenCalledTimes(2);
    expect(tracking.tripId()).toBe('t1');
  });

  it('does not start twice for the same trip', async () => {
    tracking.start('t1');
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(0);

    expect(driver['reportPosition']).toHaveBeenCalledTimes(1);
  });

  it('skips a failed send and keeps sending', async () => {
    getCurrentPoint.mockRejectedValueOnce(new LocationError('unavailable'));
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(POSITION_INTERVAL_MS);

    expect(driver['reportPosition']).toHaveBeenCalledTimes(1);
    expect(tracking.tripId()).toBe('t1');
  });

  it('stops when the trip is no longer in progress', async () => {
    driver['reportPosition'].mockRejectedValue(new ApiError('TRIP_NOT_IN_PROGRESS', 409));
    tracking.start('t1');
    await vi.advanceTimersByTimeAsync(POSITION_INTERVAL_MS * 2);

    expect(driver['reportPosition']).toHaveBeenCalledTimes(1);
    expect(tracking.tripId()).toBeNull();
  });

  it('stops when the session ends', async () => {
    tracking.start('t1');
    loggedIn.set(false);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(POSITION_INTERVAL_MS);

    expect(tracking.tripId()).toBeNull();
    expect(driver['reportPosition']).toHaveBeenCalledTimes(1);
  });

  it('resumes the trip in progress of the driver', async () => {
    driver['listMyTrips'].mockResolvedValue([
      { id: 't0', status: 'confirmed' },
      { id: 't1', status: 'in_progress' },
    ]);

    await tracking.resume();

    expect(tracking.tripId()).toBe('t1');
  });

  it('does not resume without a trip in progress or as a passenger', async () => {
    driver['listMyTrips'].mockRejectedValue(new Error('offline'));
    await tracking.resume();
    expect(tracking.tripId()).toBeNull();

    isDriver = false;
    await tracking.resume();
    expect(driver['listMyTrips']).toHaveBeenCalledTimes(1);
  });
});
