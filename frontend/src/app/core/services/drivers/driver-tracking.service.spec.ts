import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { LocationError, LocationService } from '../location/location.service';
import { DriverService } from './driver.service';
import { DriverTrackingService, POSITION_INTERVAL_MS } from './driver-tracking.service';

const POINT: [number, number] = [-2.43, 36.83];

describe('DriverTrackingService', () => {
  const loggedIn = signal(true);
  let isDriver: boolean;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let getCurrentPoint: ReturnType<typeof vi.fn>;
  let tracking: DriverTrackingService;

  beforeEach(() => {
    vi.useFakeTimers();
    loggedIn.set(true);
    isDriver = true;
    driver = {
      reportPosition: vi.fn().mockResolvedValue(undefined),
      listMyTrips: vi.fn().mockResolvedValue([]),
    };
    getCurrentPoint = vi.fn().mockResolvedValue(POINT);
    TestBed.configureTestingModule({
      providers: [
        { provide: DriverService, useValue: driver },
        { provide: LocationService, useValue: { getCurrentPoint } },
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
    vi.useRealTimers();
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
