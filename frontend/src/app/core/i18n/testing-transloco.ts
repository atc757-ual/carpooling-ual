import {
  EnvironmentProviders,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import type { TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';

const TEST_TRANSLATIONS = new InjectionToken<Record<string, Record<string, unknown>>>(
  'TEST_TRANSLATIONS',
);

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
  return makeEnvironmentProviders([
    { provide: TEST_TRANSLATIONS, useValue: translations },
    provideTransloco({
      config: {
        availableLangs: ['es', 'en'],
        defaultLang: 'es',
        reRenderOnLangChange: true,
      },
      loader: TestingTranslocoLoader,
    }),
  ]);
}
