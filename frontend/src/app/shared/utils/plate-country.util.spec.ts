import {
  isValidPlate,
  normalizePlate,
  PLATE_COUNTRY_OPTIONS,
  plateSign,
} from './plate-country.util';

describe('plate country util', () => {
  it('offers Spain first and the 31 countries of the API', () => {
    expect(PLATE_COUNTRY_OPTIONS[0]).toEqual({ code: 'ES', name: 'España', sign: 'E' });
    expect(PLATE_COUNTRY_OPTIONS).toHaveLength(31);
    expect(new Set(PLATE_COUNTRY_OPTIONS.map(({ code }) => code)).size).toBe(31);
  });

  it.each([
    ['ES', 'E'],
    ['PT', 'P'],
    ['EE', 'EST'],
    ['LI', 'FL'],
    [undefined, 'E'],
    ['US', 'E'],
  ])('shows the sign of %s as %s', (country, sign) => {
    expect(plateSign(country)).toBe(sign);
  });

  it('normalizes the plate as the API stores it', () => {
    expect(normalizePlate(' aa-00 aa ')).toBe('AA00AA');
  });

  it.each([
    ['ES', '1234 bcd'],
    ['ES', 'AL-1234-AB'],
    ['PT', 'AA-00-AA'],
    ['FR', 'AB-123-CD'],
    ['DE', 'M AB 1234'],
  ])('accepts a plate of %s ("%s")', (country, plate) => {
    expect(isValidPlate(plate, country)).toBe(true);
  });

  it.each([
    ['ES', '1234 AEI'],
    ['ES', 'AB-123-CD'],
    ['PT', 'ABCDEF'],
    ['PT', '1'],
    ['PT', '12345678901'],
  ])('rejects a plate of %s ("%s")', (country, plate) => {
    expect(isValidPlate(plate, country)).toBe(false);
  });
});
