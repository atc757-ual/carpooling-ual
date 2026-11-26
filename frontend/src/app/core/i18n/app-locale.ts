import { signal } from '@angular/core';

// El formato de fechas y números según el idioma de la app. Lo actualiza
// LanguageService al cambiar de idioma; sin él (p. ej. en los tests de
// funciones puras), español
const LOCALES = { es: 'es-ES', en: 'en-GB' } as const;

type AppLocaleLanguage = keyof typeof LOCALES;

let currentLanguage: AppLocaleLanguage = 'es';
let currentLocale: string = LOCALES.es;
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();
// El idioma cuyas traducciones ya están cargadas (cambia después de cargarlas,
// no al pedir el cambio: antes, translate() devolvería las claves)
const loadedLanguage = signal<AppLocaleLanguage>('es');

export function setAppLocale(language: AppLocaleLanguage): void {
  currentLanguage = language;
  currentLocale = LOCALES[language];
}

export function markLanguageLoaded(language: AppLocaleLanguage): void {
  loadedLanguage.set(language);
}

// Para los computed() que traducen o formatean: al leerlo, se rehacen al
// cambiar de idioma (las pestañas que Ionic deja montadas no se vuelven a crear)
export function trackLanguage(): AppLocaleLanguage {
  return loadedLanguage();
}

export function appLanguage(): AppLocaleLanguage {
  return currentLanguage;
}

export function appLocale(): string {
  return currentLocale;
}

// Un formateador de fechas en el idioma activo (se reutiliza: crearlos cuesta)
export function dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = currentLocale + JSON.stringify(options);
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(currentLocale, options);
    dateFormats.set(key, format);
  }
  return format;
}

export function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = currentLocale + JSON.stringify(options);
  let format = numberFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(currentLocale, options);
    numberFormats.set(key, format);
  }
  return format;
}
