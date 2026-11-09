import { ChatMessage } from '../../core/models/chat.model';
import {
  groupMessagesByDay,
  messageDay,
  messageText,
  messageTime,
  QUICK_REPLIES,
  QUICK_REPLY_TEXTS,
  quickRepliesForMoment,
} from './chat-texts';

describe('chat texts', () => {
  it('reads a text message or the text of its quick reply', () => {
    expect(messageText({ text: 'Hola', quickReply: null })).toBe('Hola');
    expect(messageText({ text: null, quickReply: 'running_late' })).toBe('Llego 5 min tarde');
    expect(messageText({ text: null, quickReply: null })).toBe('');
  });

  it('has a text for every quick reply of the API', () => {
    expect(QUICK_REPLIES).toHaveLength(16);
    for (const quickReply of QUICK_REPLIES) {
      expect(QUICK_REPLY_TEXTS[quickReply].length).toBeGreaterThan(0);
    }
  });

  describe('quick replies by role and moment', () => {
    const now = Date.parse('2026-11-09T08:00:00.000Z');
    const minutesAhead = (minutes: number): string =>
      new Date(now + minutes * 60_000).toISOString();
    const published = (minutes: number) => ({
      status: 'published',
      departureAt: minutesAhead(minutes),
    });
    const inProgress = { status: 'in_progress', departureAt: minutesAhead(-5) };

    it('offers each role its replies before leaving', () => {
      expect(quickRepliesForMoment(published(60), 'driver', now)).toEqual([
        'leaving_soon',
        'on_time',
        'still_coming',
        'running_late',
      ]);
      expect(quickRepliesForMoment(published(60), 'passenger', now)).toEqual([
        'still_going',
        'im_coming',
        'pickup_where',
        'running_late',
      ]);
    });

    it('moves on to the pickup replies 15 minutes before the departure', () => {
      expect(quickRepliesForMoment(published(16), 'driver', now)).toContain('leaving_soon');
      expect(quickRepliesForMoment(published(15), 'driver', now)).toContain('on_my_way');
      expect(quickRepliesForMoment(published(15), 'passenger', now)).toContain('heading_down');
    });

    it('keeps the pickup replies when the departure has passed without starting', () => {
      expect(quickRepliesForMoment(published(-10), 'driver', now)).toContain('at_pickup');
    });

    it('adds the replies of the trip while it is in progress', () => {
      const driver = quickRepliesForMoment(inProgress, 'driver', now);
      const passenger = quickRepliesForMoment(inProgress, 'passenger', now);

      expect(driver).toEqual(
        expect.arrayContaining(['on_my_way', 'arriving_soon', 'stopping_here']),
      );
      expect(passenger).toEqual(expect.arrayContaining(['heading_down', 'can_we_stop']));
      expect(passenger).not.toContain('stopping_here');
    });

    it('only uses replies that have a text', () => {
      for (const role of ['driver', 'passenger'] as const) {
        for (const trip of [published(60), published(5), inProgress]) {
          for (const quickReply of quickRepliesForMoment(trip, role, now)) {
            expect(QUICK_REPLIES).toContain(quickReply);
          }
        }
      }
    });
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
