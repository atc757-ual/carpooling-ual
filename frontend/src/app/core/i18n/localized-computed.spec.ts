import { signal } from '@angular/core';
import { markLanguageLoaded, trackLanguage } from './app-locale';
import { localizedComputed } from './localized-computed';

describe('localizedComputed', () => {
  afterEach(() => markLanguageLoaded('es'));

  // Las pestañas que Ionic deja montadas no se vuelven a crear: sus textos
  // calculados se rehacen al cargar el idioma nuevo, aunque no cambie su dato
  it('is computed again when another language is loaded', () => {
    const count = signal(2);
    let runs = 0;
    const label = localizedComputed(() => {
      runs += 1;
      return `${trackLanguage()}:${count()}`;
    });

    expect(label()).toBe('es:2');
    markLanguageLoaded('en');
    expect(label()).toBe('en:2');
    expect(runs).toBe(2);

    count.set(3);
    expect(label()).toBe('en:3');
  });
});
