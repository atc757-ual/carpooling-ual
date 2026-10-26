import { setUpGuardTest } from './guard-testing';
import { profileGuard } from './profile.guard';

describe('profileGuard', () => {
  let guard: ReturnType<typeof setUpGuardTest>;

  beforeEach(() => {
    guard = setUpGuardTest();
  });

  it('lets in a user with the required profile', () => {
    guard.logIn('driver');

    expect(guard.run(profileGuard('driver'))).toBe(true);
  });

  it('lets in a user with any of the allowed profiles', () => {
    guard.logIn('passenger');

    expect(guard.run(profileGuard('driver', 'passenger'))).toBe(true);
  });

  it('sends a user without the profile to the home page', () => {
    guard.logIn('passenger');

    expect(guard.run(profileGuard('admin'))).toBe('/tabs/home');
  });

  it('sends a guest to the login', () => {
    expect(guard.run(profileGuard('driver'))).toBe('/auth/login?returnUrl=%2Ftrips%2Fnew');
  });
});
