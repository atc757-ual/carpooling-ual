import { describe, expect, it } from 'vitest';
import errorCatalog from '../../../../../docs/api/errors.md' with { loader: 'text' };
import enDictionary from '../../../../public/i18n/en.json';
import esDictionary from '../../../../public/i18n/es.json';

// Cada código del catálogo (la primera columna de sus tablas) y los genéricos
// de NestJS, que el catálogo nombra juntos en una sola fila: getErrorMessage
// enseña errors.<código> y, sin él, el genérico «Algo ha salido mal»
const ERROR_CODE_PATTERN = /^\|\s*`([A-Z][A-Z0-9_]+)`\s*\|/gm;
const GENERIC_HTTP_CODES = ['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN'];

function documentedCodes(): string[] {
  const codes = [...errorCatalog.matchAll(ERROR_CODE_PATTERN)].map(([, code]) => code);
  return [...new Set([...codes, ...GENERIC_HTTP_CODES])];
}

describe('API error messages', () => {
  it('has a message in Spanish and English for every code in docs/api/errors.md', () => {
    const codes = documentedCodes();

    expect(codes.length).toBeGreaterThan(100);
    expect(codes.filter((code) => !(code in esDictionary.errors))).toEqual([]);
    expect(codes.filter((code) => !(code in enDictionary.errors))).toEqual([]);
  });
});
