import { QUICK_REPLIES } from './entities/chat-message.entity';
import { quickReplyCopy } from './chat-reports.service';

describe('quickReplyCopy', () => {
  it('copies the text the user saw, not the key', () => {
    expect(quickReplyCopy('at_pickup')).toBe(
      'Ya estoy en el punto (respuesta rápida)',
    );
    expect(quickReplyCopy('where_are_you')).toBe(
      '¿Dónde estás? (respuesta rápida)',
    );
  });

  it('has a text for every quick reply', () => {
    for (const quickReply of QUICK_REPLIES) {
      expect(quickReplyCopy(quickReply)).not.toContain(quickReply);
    }
  });

  it('says so when a message has neither text nor quick reply', () => {
    expect(quickReplyCopy(null)).toBe('(mensaje vacío)');
  });
});
