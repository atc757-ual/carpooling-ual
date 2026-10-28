import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Profile, User } from '../../models/user.model';
import { AuthService } from '../auth/auth.service';
import { ActiveModeService } from './active-mode.service';
import { UsersService } from './users.service';

describe('ActiveModeService', () => {
  const user = signal<Pick<User, 'profiles' | 'activeMode'> | null>(null);
  let setActiveMode: ReturnType<typeof vi.fn>;

  function create(profiles: Profile[], activeMode: User['activeMode'] = null): ActiveModeService {
    user.set({ profiles, activeMode });
    setActiveMode = vi.fn().mockResolvedValue({});
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            hasProfile: (profile: Profile) => user()?.profiles.includes(profile) ?? false,
          },
        },
        { provide: UsersService, useValue: { setActiveMode } },
      ],
    });
    return TestBed.inject(ActiveModeService);
  }

  it('has no mode without the passenger or driver profile', () => {
    const service = create([]);

    expect(service.mode()).toBeNull();
    expect(service.hasBothModes()).toBe(false);
  });

  it('uses the only profile there is', () => {
    expect(create(['driver']).mode()).toBe('driver');
  });

  it('starts as a passenger with both profiles until one is chosen', () => {
    const service = create(['passenger', 'driver']);

    expect(service.mode()).toBe('passenger');
    expect(service.hasBothModes()).toBe(true);
  });

  it('uses the mode kept on the server', () => {
    expect(create(['passenger', 'driver'], 'driver').mode()).toBe('driver');
  });

  it('ignores a kept mode the user no longer has', () => {
    expect(create(['passenger'], 'driver').mode()).toBe('passenger');
  });

  it('changes the mode at once and keeps it on the server', async () => {
    const service = create(['passenger', 'driver']);

    const change = service.setMode('driver');

    expect(service.mode()).toBe('driver');
    await change;
    expect(setActiveMode).toHaveBeenCalledWith('driver');
  });

  it('goes back to the previous mode if the server does not keep it', async () => {
    const service = create(['passenger', 'driver'], 'passenger');
    setActiveMode.mockRejectedValue(new Error('down'));

    await expect(service.setMode('driver')).rejects.toThrow('down');

    expect(service.mode()).toBe('passenger');
  });

  it('follows the user of a new session', () => {
    const service = create(['passenger', 'driver'], 'passenger');

    user.set({ profiles: ['passenger', 'driver'], activeMode: 'driver' });

    expect(service.mode()).toBe('driver');
  });
});
