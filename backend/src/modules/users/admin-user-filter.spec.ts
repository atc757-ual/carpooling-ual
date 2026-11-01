import { accountStatusOf } from './admin-user-filter';

describe('accountStatusOf', () => {
  const verified = { deactivatedAt: null, emailVerifiedAt: new Date() };

  it('puts a deleted account before anything else', () => {
    expect(
      accountStatusOf({ deactivatedAt: new Date(), emailVerifiedAt: null }, [
        false,
      ]),
    ).toBe('deleted');
  });

  it('tells an unverified email, a deactivated profile and an active account', () => {
    expect(
      accountStatusOf({ deactivatedAt: null, emailVerifiedAt: null }, [true]),
    ).toBe('email_unverified');
    expect(accountStatusOf(verified, [true, false])).toBe(
      'profile_deactivated',
    );
    expect(accountStatusOf(verified, [true, true])).toBe('active');
  });
});
