import { authGuard } from './auth.guard';
import { setUpGuardTest } from './guard-testing';

describe('authGuard', () => {
  let guard: ReturnType<typeof setUpGuardTest>;

  beforeEach(() => {
    guard = setUpGuardTest();
  });

  it('lets a logged-in user in', () => {
    guard.logIn('passenger');

    expect(guard.run(authGuard)).toBe(true);
  });

  it('sends a guest to the login, remembering the requested page', () => {
    expect(guard.run(authGuard)).toBe('/auth/login?returnUrl=%2Ftrips%2Fnew');
  });

  it('sends a guest opening the app to the welcome screen', () => {
    expect(guard.run(authGuard, '/')).toBe('/auth/welcome');
  });
});
