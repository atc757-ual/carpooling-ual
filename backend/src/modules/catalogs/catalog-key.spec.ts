import { toCatalogKey } from './catalog-key';

describe('toCatalogKey', () => {
  it('drops accents and symbols and joins the words with hyphens', () => {
    expect(toCatalogKey('Alfa Romeo')).toBe('alfa-romeo');
    expect(toCatalogKey('Lynk & Co')).toBe('lynk-co');
    expect(toCatalogKey('Škoda')).toBe('skoda');
    expect(toCatalogKey('  Mercedes-Benz  ')).toBe('mercedes-benz');
  });
});
