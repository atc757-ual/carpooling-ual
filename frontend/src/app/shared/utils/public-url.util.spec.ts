import { publicWebOrigin } from './public-url.util';

describe('publicWebOrigin', () => {
  it('uses the configured address without the trailing slash', () => {
    expect(publicWebOrigin('https://carpooling.example/', true)).toBe('https://carpooling.example');
    expect(publicWebOrigin('https://carpooling.example', false)).toBe('https://carpooling.example');
  });

  it('falls back to the page on the web and to nothing in the native app', () => {
    expect(publicWebOrigin('', false)).toBe(globalThis.location.origin);
    expect(publicWebOrigin('', true)).toBeNull();
  });
});
