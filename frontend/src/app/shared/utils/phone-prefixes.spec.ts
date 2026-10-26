import { PHONE_PREFIXES } from './phone-prefixes';

describe('phone prefixes', () => {
  it('starts with Spain and has no repeated prefixes', () => {
    expect(PHONE_PREFIXES[0]).toBe('+34');
    expect(new Set(PHONE_PREFIXES).size).toBe(PHONE_PREFIXES.length);
  });

  it('only has international prefixes', () => {
    for (const prefix of PHONE_PREFIXES) {
      expect(prefix).toMatch(/^\+\d{1,3}$/);
    }
  });
});
