import { ApiProperty } from '@nestjs/swagger';
import type { FaqTopic } from '../entities/faq-topic.entity';
import type { Faq } from '../entities/faq.entity';
import { FAQ_AUDIENCES, FAQ_CONTEXTS, FAQ_STATUSES } from '../faq-values';
import type { FaqAudience, FaqContext, FaqStatus } from '../faq-values';

// Un tema en el panel: con los dos nombres y su orden
export class AdminFaqTopicResource {
  @ApiProperty({ example: 'FaqTopic' })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'cancellations' })
  key: string;

  @ApiProperty({ example: 'Cancelaciones y penalizaciones' })
  nameEs: string;

  @ApiProperty({ example: 'Cancellations and penalties' })
  nameEn: string;

  @ApiProperty({ example: 'close-circle-outline' })
  icon: string;

  @ApiProperty({ example: 5 })
  sortOrder: number;
}

// Una pregunta en el panel: publicada o no, con los dos idiomas
export class AdminFaqResource {
  @ApiProperty({ example: 'Faq' })
  '@type': string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'cancellations', description: 'Topic key' })
  topic: string;

  @ApiProperty({ example: 2, description: 'Order within its topic' })
  sortOrder: number;

  @ApiProperty({ enum: FAQ_AUDIENCES })
  audience: FaqAudience;

  @ApiProperty({ enum: FAQ_CONTEXTS, isArray: true })
  quickContexts: FaqContext[];

  @ApiProperty({ example: '¿Puedo cancelar mi plaza?' })
  questionEs: string;

  @ApiProperty({ example: 'Can I cancel my seat?' })
  questionEn: string;

  @ApiProperty()
  answerEs: string;

  @ApiProperty()
  answerEn: string;

  @ApiProperty({ type: [String] })
  pointsEs: string[];

  @ApiProperty({ type: [String] })
  pointsEn: string[];

  @ApiProperty({ enum: FAQ_STATUSES })
  status: FaqStatus;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export function toAdminFaqTopicResource(
  topic: FaqTopic,
): AdminFaqTopicResource {
  return {
    '@type': 'FaqTopic',
    id: topic.id,
    key: topic.key,
    nameEs: topic.nameEs,
    nameEn: topic.nameEn,
    icon: topic.icon,
    sortOrder: topic.sortOrder,
  };
}

export function toAdminFaqResource(faq: Faq): AdminFaqResource {
  return {
    '@type': 'Faq',
    id: faq.id,
    topic: faq.topic.key,
    sortOrder: faq.sortOrder,
    audience: faq.audience,
    quickContexts: faq.quickContexts,
    questionEs: faq.questionEs,
    questionEn: faq.questionEn,
    answerEs: faq.answerEs,
    answerEn: faq.answerEn,
    pointsEs: faq.pointsEs,
    pointsEn: faq.pointsEn,
    status: faq.status,
    updatedAt: faq.updatedAt.toISOString(),
  };
}
