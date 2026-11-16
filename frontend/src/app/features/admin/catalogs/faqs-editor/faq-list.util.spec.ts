import { AdminFaq, AdminFaqTopic } from '../../../../core/models/admin-faq.model';
import { FaqFilters, groupFaqs, isFaqTranslated, normalizeText, toPoints } from './faq-list.util';

function topic(key: string, sortOrder: number): AdminFaqTopic {
  return { id: key, key, nameEs: key, nameEn: key, icon: 'help', sortOrder };
}

function faq(id: string, topicKey: string, changes: Partial<AdminFaq> = {}): AdminFaq {
  return {
    id,
    topic: topicKey,
    sortOrder: 1,
    audience: 'both',
    quickContexts: [],
    questionEs: `Pregunta ${id}`,
    questionEn: `Question ${id}`,
    answerEs: 'Respuesta',
    answerEn: 'Answer',
    pointsEs: [],
    pointsEn: [],
    status: 'published',
    updatedAt: '2026-11-15T10:00:00.000Z',
    ...changes,
  };
}

const TOPICS = [topic('search', 1), topic('ratings', 2)];
const FAQS = [
  faq('a', 'search'),
  faq('b', 'search', { status: 'draft', questionEs: '¿Qué es el código?' }),
  faq('c', 'search'),
];
const NO_FILTERS: FaqFilters = { topic: null, status: null, search: '' };

describe('FAQ list utilities', () => {
  it('compares text without accents or case', () => {
    expect(normalizeText('¿Qué es el CÓDIGO?')).toBe('¿que es el codigo?');
  });

  it('needs the question, the answer and the same points in English', () => {
    expect(isFaqTranslated(faq('a', 'search'))).toBe(true);
    expect(isFaqTranslated(faq('a', 'search', { questionEn: ' ' }))).toBe(false);
    expect(isFaqTranslated(faq('a', 'search', { answerEn: '' }))).toBe(false);
    expect(isFaqTranslated(faq('a', 'search', { pointsEs: ['Uno'] }))).toBe(false);
  });

  it('groups the FAQs by topic, empty topics included, with what can move', () => {
    const groups = groupFaqs(TOPICS, FAQS, NO_FILTERS);

    expect(groups.map((group) => group.topic.key)).toEqual(['search', 'ratings']);
    expect(groups[1].rows).toEqual([]);
    expect(groups[0].rows.map((row) => [row.canMoveUp, row.canMoveDown])).toEqual([
      [false, true],
      [true, true],
      [true, false],
    ]);
  });

  it('shows only the chosen topic', () => {
    const groups = groupFaqs(TOPICS, FAQS, { ...NO_FILTERS, topic: 'ratings' });

    expect(groups.map((group) => group.topic.key)).toEqual(['ratings']);
  });

  it('filters by status and hides the topics left empty', () => {
    const groups = groupFaqs(TOPICS, FAQS, { ...NO_FILTERS, status: 'draft' });

    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((row) => row.faq.id)).toEqual(['b']);
    // Sigue en medio de su tema aunque las vecinas no se vean
    expect(groups[0].rows[0]).toMatchObject({ canMoveUp: true, canMoveDown: true });
  });

  it('searches in both languages without accents', () => {
    const bySpanish = groupFaqs(TOPICS, FAQS, { ...NO_FILTERS, search: ' CODIGO ' });
    const byEnglish = groupFaqs(TOPICS, FAQS, { ...NO_FILTERS, search: 'question c' });

    expect(bySpanish[0].rows.map((row) => row.faq.id)).toEqual(['b']);
    expect(byEnglish[0].rows.map((row) => row.faq.id)).toEqual(['c']);
    expect(groupFaqs(TOPICS, FAQS, { ...NO_FILTERS, search: 'nada' })).toEqual([]);
  });

  it('reads the points one per line', () => {
    expect(toPoints(' Uno \n\n Dos\n')).toEqual(['Uno', 'Dos']);
    expect(toPoints('')).toEqual([]);
  });
});
