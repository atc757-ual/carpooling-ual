import {
  EnvironmentProviders,
  ENVIRONMENT_INITIALIZER,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import type { TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import es from '../../../../public/i18n/es.json';

const TEST_TRANSLATIONS = new InjectionToken<Record<string, Record<string, unknown>>>(
  'TEST_TRANSLATIONS',
);

const DEFAULT_TEST_TRANSLATIONS: Record<string, Record<string, unknown>> = {
  es,
  en,
};

function mergeTranslations(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = merged[key];
    merged[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? mergeTranslations(
            (baseValue as Record<string, unknown> | undefined) ?? {},
            value as Record<string, unknown>,
          )
        : value;
  }
  return merged;
}

@Injectable()
class TestingTranslocoLoader implements TranslocoLoader {
  private readonly translations = inject(TEST_TRANSLATIONS, { optional: true }) ?? {};

  getTranslation(lang: string) {
    return of(this.translations[lang] ?? {});
  }
}

export function provideTestingTransloco(
  translations: Record<string, Record<string, unknown>> = {},
): EnvironmentProviders {
  try {
    globalThis.localStorage?.setItem('carpooling_language', 'es');
  } catch {
    // El almacenamiento puede no estar disponible en el entorno de pruebas
  }

  const mergedTranslations = { ...DEFAULT_TEST_TRANSLATIONS };
  for (const [language, dictionary] of Object.entries(translations)) {
    mergedTranslations[language] = mergeTranslations(
      mergedTranslations[language] ?? {},
      dictionary,
    );
  }
  return makeEnvironmentProviders([
    { provide: TEST_TRANSLATIONS, useValue: mergedTranslations },
    provideTransloco({
      config: {
        availableLangs: ['es', 'en'],
        defaultLang: 'es',
        reRenderOnLangChange: true,
      },
      loader: TestingTranslocoLoader,
    }),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const transloco = inject(TranslocoService);
        for (const [lang, dict] of Object.entries(mergedTranslations)) {
          transloco.setTranslation(dict, lang);
        }
      },
    },
  ]);
}

export function provideTranslocoTestingSupport(
  translations: Record<string, Record<string, unknown>> = {},
): EnvironmentProviders {
  return provideTestingTransloco(translations);
}
