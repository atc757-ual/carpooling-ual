import { accountStatusOf } from './admin-user-filter';

describe('accountStatusOf', () => {
  const verified = {
    deactivatedAt: null,
    disabledAt: null,
    emailVerifiedAt: new Date(),
  };

  it('puts a deleted account before anything else', () => {
    expect(
      accountStatusOf(
        {
          deactivatedAt: new Date(),
          disabledAt: new Date(),
          emailVerifiedAt: null,
        },
        [false],
      ),
    ).toBe('deleted');
  });

  it('puts a disabled account before its other states', () => {
    expect(
      accountStatusOf(
        { deactivatedAt: null, disabledAt: new Date(), emailVerifiedAt: null },
        [false],
      ),
    ).toBe('disabled');
  });

  it('tells an unverified email, a deactivated profile and an active account', () => {
    expect(
      accountStatusOf(
        { deactivatedAt: null, disabledAt: null, emailVerifiedAt: null },
        [true],
      ),
    ).toBe('email_unverified');
    expect(accountStatusOf(verified, [true, false])).toBe(
      'profile_deactivated',
    );
    expect(accountStatusOf(verified, [true, true])).toBe('active');
  });
});
