import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import type { FaqTopic } from '../entities/faq-topic.entity';
import type { Faq } from '../entities/faq.entity';
import { FAQ_AUDIENCES, FAQ_CONTEXTS } from '../faq-values';
import type { FaqAudience, FaqContext, FaqLang } from '../faq-values';

// Un tema del centro de ayuda, en el idioma pedido
export class FaqTopicResource {
  @ApiProperty({ example: 'FaqTopic' })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'cancellations' })
  key: string;

  @ApiProperty({ example: 'Cancelaciones y penalizaciones' })
  name: string;

  @ApiProperty({
    example: 'close-circle-outline',
    description: 'Ionicons name',
  })
  icon: string;
}

// Una pregunta frecuente publicada, en el idioma pedido
export class FaqResource {
  @ApiProperty({ example: 'Faq' })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/faqs/6f1c1c0e-6f0b-4a51-9d3e-0e3c5d2f8a11' })
  href: string;

  @ApiProperty({ example: 'cancellations', description: 'Topic key' })
  topic: string;

  @ApiProperty({ enum: FAQ_AUDIENCES })
  audience: FaqAudience;

  @ApiProperty({
    enum: FAQ_CONTEXTS,
    isArray: true,
    description: 'Screens that show it as a quick question',
  })
  quickContexts: FaqContext[];

  @ApiProperty({ example: '¿Puedo cancelar mi plaza?' })
  question: string;

  @ApiProperty({ example: 'Sí, desde Tus viajes, y depende del momento:' })
  answer: string;

  @ApiProperty({
    type: [String],
    description: 'Optional list shown under the answer',
  })
  points: string[];
}

export function toFaqTopicResource(
  topic: FaqTopic,
  lang: FaqLang,
): FaqTopicResource {
  return {
    '@type': 'FaqTopic',
    id: topic.id,
    key: topic.key,
    name: lang === 'en' ? topic.nameEn : topic.nameEs,
    icon: topic.icon,
  };
}

export function toFaqResource(faq: Faq, lang: FaqLang): FaqResource {
  const isEnglish = lang === 'en';
  return {
    '@type': 'Faq',
    id: faq.id,
    href: `/${API_PREFIX}/faqs/${faq.id}`,
    topic: faq.topic.key,
    audience: faq.audience,
    quickContexts: faq.quickContexts,
    question: isEnglish ? faq.questionEn : faq.questionEs,
    answer: isEnglish ? faq.answerEn : faq.answerEs,
    points: isEnglish ? faq.pointsEn : faq.pointsEs,
  };
}
