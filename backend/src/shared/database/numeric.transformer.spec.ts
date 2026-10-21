import { numericTransformer } from './numeric.transformer';

describe('numericTransformer', () => {
  it('converts the text returned by PostgreSQL into a number', () => {
    expect(numericTransformer.from('4.80')).toBe(4.8);
  });

  it('keeps null values (column without a value)', () => {
    expect(numericTransformer.from(null)).toBeNull();
  });

  it('writes numbers unchanged', () => {
    expect(numericTransformer.to(4.5)).toBe(4.5);
  });
});
