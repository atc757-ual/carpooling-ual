import type { TwinEvent } from './twin-event';
import { UserTwin } from './user-twin';

function event(type: string, payload: Record<string, unknown> = {}): TwinEvent {
  return {
    id: type,
    sequence: 1,
    type,
    version: 1,
    sourceEntityId: 'u-1',
    payload,
    occurredAt: new Date('2026-11-04T08:00:00Z'),
  };
}

describe('UserTwin', () => {
  let user: UserTwin;

  beforeEach(() => {
    user = new UserTwin('u-1');
  });

  it('takes the profiles it registers with', () => {
    user.apply(
      event('user.registered', { profiles: ['passenger', 'driver', 7] }),
    );

    expect([...user.profiles]).toEqual(['passenger', 'driver']);
    expect(user).toMatchObject({
      isActive: true,
      isPhoneVerified: false,
      activeMode: null,
      updatedAt: new Date('2026-11-04T08:00:00Z'),
    });
  });

  it('ignores a registration without a list of profiles', () => {
    user.apply(event('user.registered', { profiles: 'driver' }));

    expect(user.profiles.size).toBe(0);
  });

  it('activates and deactivates profiles', () => {
    user.apply(event('user.profile_activated', { profile: 'driver' }));
    user.apply(event('user.profile_activated', { profile: 'passenger' }));
    user.apply(event('user.profile_deactivated', { profile: 'driver' }));
    user.apply(event('user.profile_activated', {}));

    expect([...user.profiles]).toEqual(['passenger']);
  });

  it('follows the active mode, the phone and the account', () => {
    user.apply(event('user.active_mode_changed', { activeMode: 'driver' }));
    user.apply(event('user.active_mode_changed', {}));
    user.apply(event('user.phone_verified'));
    user.apply(event('user.deactivated'));

    expect(user).toMatchObject({
      activeMode: 'driver',
      isPhoneVerified: true,
      isActive: false,
    });
  });

  it('does not apply events that are not about users', () => {
    expect(user.apply(event('user.updated'))).toBe(false);
    expect(user.apply(event('trip.published'))).toBe(false);
    expect(user.updatedAt).toBeNull();
  });
});
