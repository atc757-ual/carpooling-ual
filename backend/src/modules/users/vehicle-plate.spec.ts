import { isValidPlate, normalizePlate } from './vehicle-plate';

describe('vehicle plate', () => {
  it.each([
    ['1234 bcd', '1234BCD'],
    ['1234-BCD', '1234BCD'],
    [' al-1234-ab ', 'AL1234AB'],
  ])('normalizes "%s" to "%s"', (rawPlate, plate) => {
    expect(normalizePlate(rawPlate)).toBe(plate);
  });

  it.each(['1234BCD', '0000ZZZ', 'AL1234AB', 'M1234Z', 'GR1234'])(
    'accepts the Spanish plate "%s"',
    (plate) => {
      expect(isValidPlate(plate)).toBe(true);
    },
  );

  it.each([
    ['vowels are not used', '1234AEI'],
    ['Q is not used', '1234QBC'],
    ['too few digits', '123BCD'],
    ['letters only', 'ABCDEFG'],
    ['empty', ''],
  ])('rejects a plate when %s ("%s")', (_case, plate) => {
    expect(isValidPlate(plate)).toBe(false);
  });
});
