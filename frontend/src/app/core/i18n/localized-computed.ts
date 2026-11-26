import { computed, Signal } from '@angular/core';
import { trackLanguage } from './app-locale';

// Un computed() que traduce (translate) o formatea en el idioma activo: además
// de sus datos, depende del idioma, así que se rehace al cambiarlo. Sin esto,
// las pestañas que Ionic deja montadas seguirían en el idioma anterior
export function localizedComputed<T>(compute: () => T): Signal<T> {
  return computed(() => {
    trackLanguage();
    return compute();
  });
}
