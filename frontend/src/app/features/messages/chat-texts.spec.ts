import { ChatMessage } from '../../core/models/chat.model';
import {
  groupMessagesByDay,
  messageDay,
  messageText,
  messageTime,
  QUICK_REPLIES,
} from './chat-texts';

describe('chat texts', () => {
  it('reads a text message or the text of its quick reply', () => {
    expect(messageText({ text: 'Hola', quickReply: null })).toBe('Hola');
    expect(messageText({ text: null, quickReply: 'running_late' })).toBe('Llego 5 min tarde');
    expect(messageText({ text: null, quickReply: null })).toBe('');
  });

  it('offers the four quick replies of the API', () => {
    expect(QUICK_REPLIES).toEqual(['at_pickup', 'running_late', 'on_my_way', 'where_are_you']);
  });

  it('shows the time in 24 h', () => {
    expect(messageTime('2026-11-03T07:05:00')).toBe('07:05');
  });

  it('names each day: today, yesterday, the date and, from another year, with the year', () => {
    const now = new Date('2026-11-07T10:00:00');
    expect(messageDay('2026-11-07T08:00:00', now)).toBe('Hoy');
    expect(messageDay('2026-11-06T23:30:00', now)).toBe('Ayer');
    expect(messageDay('2026-11-03T22:25:00', now)).toBe('3 nov');
    expect(messageDay('2025-11-03T22:25:00', now)).toBe('3 nov 2025');
  });

  it('groups the messages by day, in their order', () => {
    const now = new Date('2026-11-07T10:00:00');
    const at = (id: string, createdAt: string) => ({ id, createdAt }) as ChatMessage;
    const groups = groupMessagesByDay(
      [
        at('a', '2026-11-06T20:00:00'),
        at('b', '2026-11-06T21:00:00'),
        at('c', '2026-11-07T09:00:00'),
      ],
      now,
    );
    expect(groups.map(({ day, messages }) => [day, messages.map(({ id }) => id)])).toEqual([
      ['Ayer', ['a', 'b']],
      ['Hoy', ['c']],
    ]);
  });
});
