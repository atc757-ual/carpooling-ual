import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';

// De qué trata el mensaje (se ve en el asunto del correo a soporte)
export const SUPPORT_TOPICS = [
  'trip',
  'account',
  'bug',
  'suggestion',
  'other',
] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const SUPPORT_MESSAGE_MIN_LENGTH = 20;
export const SUPPORT_MESSAGE_MAX_LENGTH = 1000;

// Cuerpo de POST /api/support/messages
export class SendSupportMessageDto {
  @ApiProperty({ enum: SUPPORT_TOPICS, example: 'trip' })
  @IsIn(SUPPORT_TOPICS)
  topic!: SupportTopic;

  @ApiProperty({
    minLength: SUPPORT_MESSAGE_MIN_LENGTH,
    maxLength: SUPPORT_MESSAGE_MAX_LENGTH,
    example: 'El conductor no ha llegado al punto de recogida y no responde.',
  })
  @IsString()
  @Length(SUPPORT_MESSAGE_MIN_LENGTH, SUPPORT_MESSAGE_MAX_LENGTH)
  message!: string;
}
