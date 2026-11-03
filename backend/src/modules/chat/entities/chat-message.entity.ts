import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const CHAT_MESSAGE_KINDS = ['text', 'quick'] as const;
export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];

// Respuestas rápidas: se guarda la clave y el texto lo pone la app en su
// idioma. Son lo único que puede enviar el conductor con el viaje en curso
export const QUICK_REPLIES = [
  'at_pickup',
  'running_late',
  'on_my_way',
  'where_are_you',
] as const;
export type QuickReply = (typeof QUICK_REPLIES)[number];

export const MAX_CHAT_MESSAGE_LENGTH = 500;

// Tabla chat_messages: un mensaje del chat de un viaje. Solo los ids, sin
// relaciones con entidades de otros módulos (fronteras)
@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({
    type: 'enum',
    enum: CHAT_MESSAGE_KINDS,
    enumName: 'chat_message_kind',
  })
  kind: ChatMessageKind;

  // Solo en los de texto
  @Column({ type: 'varchar', length: MAX_CHAT_MESSAGE_LENGTH, nullable: true })
  body: string | null;

  // Solo en las respuestas rápidas
  @Column({ name: 'quick_reply', type: 'varchar', length: 30, nullable: true })
  quickReply: QuickReply | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
