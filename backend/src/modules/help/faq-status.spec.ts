import { canChangeFaqStatus, isFaqTranslated } from './faq-status';
import { FAQ_STATUSES } from './faq-values';

describe('FAQ status', () => {
  // Todas las combinaciones (RNF-10): solo se pasa de un estado al otro
  it.each(FAQ_STATUSES.flatMap((from) => FAQ_STATUSES.map((to) => [from, to])))(
    '%s → %s',
    (from, to) => {
      expect(canChangeFaqStatus(from, to)).toBe(from !== to);
    },
  );
});

describe('isFaqTranslated', () => {
  const translated = {
    questionEn: 'Can I cancel?',
    answerEn: 'Yes.',
    pointsEs: ['Hasta 10 minutos antes'],
    pointsEn: ['Up to 10 minutes before'],
  };

  it('accepts a question with its English texts and the same points', () => {
    expect(isFaqTranslated(translated)).toBe(true);
    expect(isFaqTranslated({ ...translated, pointsEs: [], pointsEn: [] })).toBe(
      true,
    );
  });

  it.each([
    ['the question', { questionEn: '  ' }],
    ['the answer', { answerEn: '' }],
    ['a point', { pointsEn: [] }],
  ])('rejects it without %s in English', (_missing, change) => {
    expect(isFaqTranslated({ ...translated, ...change })).toBe(false);
  });
});
