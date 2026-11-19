import { LegalDocument } from '../entities/legal-document.entity';
import {
  toAdminLegalDocumentResource,
  toLegalDocumentResource,
} from './legal-document.resource';

function document(changes: Partial<LegalDocument> = {}): LegalDocument {
  return Object.assign(new LegalDocument(), {
    id: 'd1',
    type: 'terms',
    version: '1.1',
    content: '<p>Texto</p>',
    summary: 'Qué cambia.',
    contentEn: '<p>Text</p>',
    summaryEn: 'What changes.',
    status: 'published',
    changeType: 'minor',
    publishedAt: new Date('2026-11-19T10:00:00Z'),
    updatedAt: new Date('2026-11-19T10:00:00Z'),
    ...changes,
  });
}

describe('legal document resource', () => {
  it('is in Spanish by default and in English when asked for', () => {
    expect(toLegalDocumentResource(document())).toMatchObject({
      lang: 'es',
      content: '<p>Texto</p>',
      summary: 'Qué cambia.',
    });
    expect(toLegalDocumentResource(document(), 'en')).toMatchObject({
      lang: 'en',
      content: '<p>Text</p>',
      summary: 'What changes.',
    });
  });

  it('falls back to the Spanish text when there is no translation', () => {
    const untranslated = document({ contentEn: null, summaryEn: null });

    expect(toLegalDocumentResource(untranslated, 'en')).toMatchObject({
      lang: 'es',
      content: '<p>Texto</p>',
      summary: 'Qué cambia.',
    });
  });

  it('gives the panel both languages', () => {
    expect(toAdminLegalDocumentResource(document())).toMatchObject({
      lang: 'es',
      content: '<p>Texto</p>',
      contentEn: '<p>Text</p>',
      summaryEn: 'What changes.',
    });
  });
});
