import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { FaqAudience, FaqContext, FaqStatus } from '../faq-values';
import { FaqTopic } from './faq-topic.entity';

// Tabla faqs: una pregunta frecuente con su respuesta (y, si los tiene, sus
// puntos) en español e inglés. Pertenece a un tema, va dirigida a un modo
// (o a los dos) y puede ser pregunta rápida de varias pantallas. Sin
// versiones: es ayuda, no un contrato como los documentos legales
@Entity('faqs')
@Index('idx_faqs_topic_order', ['topicId', 'sortOrder'])
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'topic_id', type: 'uuid' })
  topicId: string;

  @ManyToOne(() => FaqTopic, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topic_id' })
  topic: FaqTopic;

  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 10 })
  audience: FaqAudience;

  @Column({ name: 'quick_contexts', type: 'text', array: true, default: '{}' })
  quickContexts: FaqContext[];

  @Column({ name: 'question_es', type: 'varchar', length: 160 })
  questionEs: string;

  @Column({ name: 'question_en', type: 'varchar', length: 160 })
  questionEn: string;

  @Column({ name: 'answer_es', type: 'text' })
  answerEs: string;

  @Column({ name: 'answer_en', type: 'text' })
  answerEn: string;

  @Column({ name: 'points_es', type: 'text', array: true, default: '{}' })
  pointsEs: string[];

  @Column({ name: 'points_en', type: 'text', array: true, default: '{}' })
  pointsEn: string[];

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status: FaqStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
