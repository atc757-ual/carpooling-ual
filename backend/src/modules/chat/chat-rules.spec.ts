import { type ChatTrip, chatRoleOf, isChatOpen } from './chat-rules';

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
    ['finished', false],
    ['cancelled', false],
  ] as const)('is open when the trip is %s: %s', (status, isOpen) => {
    expect(isChatOpen(trip({ status }))).toBe(isOpen);
  });
});
