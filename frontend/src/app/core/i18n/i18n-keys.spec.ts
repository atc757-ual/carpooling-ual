import { describe, expect, it } from 'vitest';
import enDictionary from '../../../../public/i18n/en.json';
import esDictionary from '../../../../public/i18n/es.json';

function extractLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return extractLeafKeys(value as Record<string, unknown>, fullPath);
    }
    return [fullPath];
  });
}

describe('i18n key parity', () => {
  it('has identical translation keys in Spanish and English', () => {
    const esKeys = extractLeafKeys(esDictionary).sort();
    const enKeys = extractLeafKeys(enDictionary).sort();

    const missingInEn = esKeys.filter((key) => !enKeys.includes(key));
    const missingInEs = enKeys.filter((key) => !esKeys.includes(key));

    expect(missingInEn).toEqual([]);
    expect(missingInEs).toEqual([]);
    expect(esKeys).toEqual(enKeys);
  });
});
