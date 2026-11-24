import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UsualTrip } from '../../../core/models/usual-trip.model';
import { PreferencesPlugin } from '../../../core/plugins/preferences-plugin';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsualTripService } from './usual-trip.service';

const TRIP: UsualTrip = {
  place: { id: 'p1', name: 'Roquetas de Mar', locality: 'Roquetas', coordinates: [-2.6, 36.76] },
  parking: { id: 'P1', name: 'Parking P1' },
  weekdays: [1, 3],
  arrivalTime: '08:00',
  returnTime: null,
  margin: 20,
  seats: 1,
};

describe('UsualTripService', () => {
  let stored: string | null;
  let logoutTasks: (() => Promise<void>)[];
  const preferences = {
    get: vi.fn(() => Promise.resolve(stored)),
    set: vi.fn((_key: string, value: string) => {
      stored = value;
      return Promise.resolve();
    }),
    remove: vi.fn(() => {
      stored = null;
      return Promise.resolve();
    }),
  };

  async function create(): Promise<UsualTripService> {
    logoutTasks = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: PreferencesPlugin, useValue: preferences },
        {
          provide: AuthService,
          useValue: { onBeforeLogout: (task: () => Promise<void>) => logoutTasks.push(task) },
        },
      ],
    });
    const service = TestBed.inject(UsualTripService);
    expect(service.isLoaded()).toBe(false);
    await service.load();
    expect(service.isLoaded()).toBe(true);
    return service;
  }

  beforeEach(() => {
    stored = null;
  });

  it('starts empty, saves the trip on this device and reads it back', async () => {
    const service = await create();
    expect(service.trip()).toBeNull();

    await service.save(TRIP);
    expect(service.trip()).toEqual(TRIP);
    expect(preferences.set).toHaveBeenCalledWith('matching.usual-trip', JSON.stringify(TRIP));

    TestBed.resetTestingModule();
    expect((await create()).trip()).toEqual(TRIP);
  });

  it('forgets a broken stored trip', async () => {
    stored = '{not json';
    expect((await create()).trip()).toBeNull();
    TestBed.resetTestingModule();
    stored = JSON.stringify({ ...TRIP, weekdays: [] });
    expect((await create()).trip()).toBeNull();
  });

  it('deletes it when the session is closed', async () => {
    stored = JSON.stringify(TRIP);
    const service = await create();
    expect(service.trip()).toEqual(TRIP);

    await Promise.all(logoutTasks.map((task) => task()));

    expect(service.trip()).toBeNull();
    expect(stored).toBeNull();
  });
});
