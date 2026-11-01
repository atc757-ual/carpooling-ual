import { isAccountStatus, statusesOf } from './admin-user-status';

describe('admin user status', () => {
  it('is active only without any other status', () => {
    expect(statusesOf('active', false, 0)).toEqual(['active']);
  });

  it('lists every status from the most to the least serious', () => {
    expect(statusesOf('profile_deactivated', true, 2)).toEqual([
      'profile_deactivated',
      'suspended',
      'open_incidents',
    ]);
    expect(statusesOf('active', false, 1)).toEqual(['open_incidents']);
  });

  it('tells the statuses the users module filters by itself', () => {
    expect(isAccountStatus('deleted')).toBe(true);
    expect(isAccountStatus('suspended')).toBe(false);
    expect(isAccountStatus('open_incidents')).toBe(false);
  });
});
