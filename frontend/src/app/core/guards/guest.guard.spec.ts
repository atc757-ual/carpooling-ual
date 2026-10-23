import { setUpGuardTest } from './guard-testing';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let guard: ReturnType<typeof setUpGuardTest>;

  beforeEach(() => {
    guard = setUpGuardTest();
  });

  it('lets a guest in', () => {
    expect(guard.run(guestGuard)).toBe(true);
  });

  it('sends a logged-in user to the home page', () => {
    guard.logIn('passenger');

    expect(guard.run(guestGuard)).toBe('/');
  });
});
