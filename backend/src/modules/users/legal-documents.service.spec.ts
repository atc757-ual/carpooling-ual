import {
  compareLegalVersions,
  nextLegalVersion,
} from './legal-documents.service';
import { computeContentHash } from './user-consent';

describe('legal document versions', () => {
  it('raises the major version on a major change and the minor one otherwise', () => {
    expect(nextLegalVersion('1.4', 'major')).toBe('2.0');
    expect(nextLegalVersion('1.4', 'minor')).toBe('1.5');
    expect(nextLegalVersion('1.9', 'minor')).toBe('1.10');
  });

  it('compares the numbers, not the text', () => {
    expect(compareLegalVersions('1.10', '1.9')).toBeGreaterThan(0);
    expect(compareLegalVersions('2.0', '1.10')).toBeGreaterThan(0);
    expect(compareLegalVersions('1.1', '2.0')).toBeLessThan(0);
    expect(compareLegalVersions('2.0', '2.0')).toBe(0);
  });

  it('hashes the accepted text with SHA-256', () => {
    expect(computeContentHash('<p>Hola</p>')).toMatch(/^[0-9a-f]{64}$/);
    expect(computeContentHash('<p>Hola</p>')).toBe(
      computeContentHash('<p>Hola</p>'),
    );
    expect(computeContentHash('<p>Hola</p>')).not.toBe(
      computeContentHash('<p>Hola.</p>'),
    );
  });
});
