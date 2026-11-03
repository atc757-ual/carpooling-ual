import { messageText, messageTime, QUICK_REPLIES } from './chat-texts';

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
});
