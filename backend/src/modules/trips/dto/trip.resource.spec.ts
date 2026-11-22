import { parseTripCode, tripCode } from './trip.resource';

describe('tripCode', () => {
  it('pads the number to four digits and grows beyond them', () => {
    expect(tripCode(1)).toBe('VJ-0001');
    expect(tripCode(42)).toBe('VJ-0042');
    expect(tripCode(12345)).toBe('VJ-12345');
  });
});

describe('parseTripCode', () => {
  it('reads the number of a code, with or without the dash and in any case', () => {
    expect(parseTripCode('VJ-0042')).toBe(42);
    expect(parseTripCode(' vj42 ')).toBe(42);
    expect(parseTripCode('Vj-12345')).toBe(12345);
  });

  it('answers null for any other text', () => {
    expect(parseTripCode('42')).toBeNull();
    expect(parseTripCode('javier')).toBeNull();
    expect(parseTripCode('VJ-')).toBeNull();
    expect(parseTripCode('INC-0042')).toBeNull();
  });
});
