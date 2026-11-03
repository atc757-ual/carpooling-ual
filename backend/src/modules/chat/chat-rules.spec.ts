import {
  CHAT_OPEN_AFTER_FINISH_MS,
  type ChatTrip,
  chatRoleOf,
  isChatOpen,
  isQuickRepliesOnly,
} from './chat-rules';

const NOW = new Date('2026-11-03T12:00:00Z');

function trip(overrides: Partial<ChatTrip> = {}): ChatTrip {
  return {
    id: 't1',
    driverId: 'dan',
    status: 'confirmed',
    finishedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('chat rules', () => {
  it('tells the driver, an accepted passenger and anyone else apart', () => {
    expect(chatRoleOf(trip(), 'dan', ['pia'])).toBe('driver');
    expect(chatRoleOf(trip(), 'pia', ['pia'])).toBe('passenger');
    expect(chatRoleOf(trip(), 'leo', ['pia'])).toBeNull();
  });

  it.each([
    ['published', false],
    ['confirmed', true],
    ['in_progress', true],
    ['cancelled', false],
  ] as const)('is open when the trip is %s: %s', (status, isOpen) => {
    expect(isChatOpen(trip({ status }), NOW)).toBe(isOpen);
  });

  it('stays open for 24 h after the trip finishes', () => {
    const finishedAt = (msAgo: number) => new Date(NOW.getTime() - msAgo);

    expect(
      isChatOpen(
        trip({ status: 'finished', finishedAt: finishedAt(1000) }),
        NOW,
      ),
    ).toBe(true);
    expect(
      isChatOpen(
        trip({
          status: 'finished',
          finishedAt: finishedAt(CHAT_OPEN_AFTER_FINISH_MS),
        }),
        NOW,
      ),
    ).toBe(false);
    // Los antiguos sin finished_at usan el último cambio
    expect(
      isChatOpen(
        trip({
          status: 'finished',
          updatedAt: finishedAt(CHAT_OPEN_AFTER_FINISH_MS + 1),
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it('only limits the driver to quick replies while the trip is in progress', () => {
    expect(isQuickRepliesOnly(trip({ status: 'in_progress' }), 'driver')).toBe(
      true,
    );
    expect(
      isQuickRepliesOnly(trip({ status: 'in_progress' }), 'passenger'),
    ).toBe(false);
    expect(isQuickRepliesOnly(trip({ status: 'confirmed' }), 'driver')).toBe(
      false,
    );
  });
});
