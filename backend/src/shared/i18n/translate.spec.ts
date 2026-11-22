import { translate, translationKeys } from './translate';

describe('translate', () => {
  it('reads the text of a key in each language', () => {
    expect(translate('es', 'push.request_received.title')).toBe(
      'Te han pedido plaza',
    );
    expect(translate('en', 'push.request_received.title')).toBe(
      'Someone asked for a seat',
    );
  });

  it('puts the values in their place and leaves the missing ones', () => {
    expect(translate('es', 'mail.greeting', { name: 'Ana' })).toBe(
      'Hola, Ana:',
    );
    expect(translate('en', 'mail.code.expires', { minutes: 15 })).toBe(
      'It expires in 15 minutes.',
    );
    expect(translate('en', 'mail.greeting')).toBe('Hi {{ name }},');
  });

  it('fails on a key that does not exist or is not a text', () => {
    expect(() => translate('es', 'push.unknown.title')).toThrow(
      'Missing translation es:push.unknown.title',
    );
    expect(() => translate('es', 'mail.code')).toThrow();
  });

  it('has the same keys in both languages', () => {
    expect(translationKeys('en')).toEqual(translationKeys('es'));
    expect(translationKeys('es').length).toBeGreaterThan(40);
  });
});
