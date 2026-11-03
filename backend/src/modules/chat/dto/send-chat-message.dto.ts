import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, ValidateBy, ValidateIf } from 'class-validator';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  QUICK_REPLIES,
  type QuickReply,
} from '../entities/chat-message.entity';

const QUICK_REPLY_SET: ReadonlySet<string> = new Set(QUICK_REPLIES);

// Cuerpo de POST /api/trips/{id}/messages: o un texto o una respuesta rápida,
// nunca los dos ni ninguno
export class SendChatMessageDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: MAX_CHAT_MESSAGE_LENGTH,
    description: 'Plain text (trimmed). Send it or quickReply, not both',
    example: 'Estoy en la puerta del portal',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((dto: SendChatMessageDto) => dto.quickReply === undefined)
  @IsString()
  @Length(1, MAX_CHAT_MESSAGE_LENGTH)
  text?: string;

  @ApiPropertyOptional({
    enum: QUICK_REPLIES,
    description:
      'A quick reply; the only kind the driver can send while the trip is in progress',
  })
  @ValidateBy({
    name: 'quickReplyOrText',
    validator: {
      validate: (value: unknown, args): boolean => {
        const hasText = (args?.object as SendChatMessageDto).text !== undefined;
        return hasText
          ? value === undefined
          : typeof value === 'string' && QUICK_REPLY_SET.has(value);
      },
      defaultMessage: () =>
        `send either text or a quickReply (${QUICK_REPLIES.join(', ')})`,
    },
  })
  quickReply?: QuickReply;
}
