import type { FaqTopic } from '../entities/faq-topic.entity';
import type { Faq } from '../entities/faq.entity';
import { escapeLike } from '../faqs.service';
import { toFaqResource, toFaqTopicResource } from './faq.resource';

const topic = {
  id: 'topic-id',
  key: 'cancellations',
  nameEs: 'Cancelaciones y penalizaciones',
  nameEn: 'Cancellations and penalties',
  icon: 'close-circle-outline',
} as FaqTopic;

const faq = {
  id: 'faq-id',
  topic,
  audience: 'passenger',
  quickContexts: ['support'],
  questionEs: '¿Puedo cancelar mi plaza?',
  questionEn: 'Can I cancel my seat?',
  answerEs: 'Sí, desde Tus viajes.',
  answerEn: 'Yes, from Your trips.',
  pointsEs: ['Hasta 10 minutos antes'],
  pointsEn: ['Up to 10 minutes before'],
} as Faq;

describe('FAQ resources', () => {
  it('gives the topic in the language asked for', () => {
    expect(toFaqTopicResource(topic, 'es')).toEqual({
      '@type': 'FaqTopic',
      id: 'topic-id',
      key: 'cancellations',
      name: 'Cancelaciones y penalizaciones',
      icon: 'close-circle-outline',
    });
    expect(toFaqTopicResource(topic, 'en').name).toBe(
      'Cancellations and penalties',
    );
  });

  it('gives the FAQ in Spanish with its link and topic key', () => {
    expect(toFaqResource(faq, 'es')).toEqual({
      '@type': 'Faq',
      id: 'faq-id',
      href: '/api/faqs/faq-id',
      topic: 'cancellations',
      audience: 'passenger',
      quickContexts: ['support'],
      question: '¿Puedo cancelar mi plaza?',
      answer: 'Sí, desde Tus viajes.',
      points: ['Hasta 10 minutos antes'],
    });
  });

  it('gives the FAQ in English', () => {
    const resource = toFaqResource(faq, 'en');
    expect(resource.question).toBe('Can I cancel my seat?');
    expect(resource.answer).toBe('Yes, from Your trips.');
    expect(resource.points).toEqual(['Up to 10 minutes before']);
  });
});

describe('escapeLike', () => {
  it('turns the LIKE wildcards into plain text', () => {
    expect(escapeLike(String.raw`100%_a\b`)).toBe(String.raw`100\%\_a\\b`);
  });

  it('leaves any other text as it is', () => {
    expect(escapeLike('código')).toBe('código');
  });
});
