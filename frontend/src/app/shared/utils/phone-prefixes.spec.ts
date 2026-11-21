import { getPhonePlaceholder, getPrefixCountry, PHONE_PREFIXES } from './phone-prefixes';

describe('phone prefixes', () => {
  it('starts with Spain and has no repeated prefixes', () => {
    expect(PHONE_PREFIXES[0]).toBe('+34');
    expect(new Set(PHONE_PREFIXES).size).toBe(PHONE_PREFIXES.length);
  });

  it('provides a dynamic placeholder per prefix', () => {
    expect(getPhonePlaceholder('+34')).toBe('612 345 678');
    expect(getPhonePlaceholder('+1')).toBe('202 555 0123');
    expect(getPhonePlaceholder('+33')).toBe('6 12 34 56 78');
    expect(getPhonePlaceholder('+999')).toBe('612 345 678');
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
