import { getPrefixCountry, PHONE_PREFIXES } from './phone-prefixes';

describe('phone prefixes', () => {
  it('starts with Spain and has no repeated prefixes', () => {
    expect(PHONE_PREFIXES[0]).toBe('+34');
    expect(new Set(PHONE_PREFIXES).size).toBe(PHONE_PREFIXES.length);
  });

  it('knows the country of each prefix, for its flag', () => {
    expect(getPrefixCountry('+34')).toBe('es');
    expect(getPrefixCountry('+44')).toBe('gb');
    expect(getPrefixCountry('+999')).toBe('');
  });

  it('only has international prefixes', () => {
    for (const prefix of PHONE_PREFIXES) {
      expect(prefix).toMatch(/^\+\d{1,3}$/);
    }
  });
});
