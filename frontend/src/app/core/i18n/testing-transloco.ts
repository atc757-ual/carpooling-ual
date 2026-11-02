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

const DEFAULT_TEST_TRANSLATIONS: Record<string, Record<string, unknown>> = {
  es: {
    brand: { tagline: 'Sistema de movilidad compartida' },
    common: {
      countryPrefixLabel: 'Prefijo del país: {{ prefix }}',
      countryPrefixList: 'Prefijos telefónicos disponibles',
    },
    auth: {
      layout: {
        verifiedCommunity: 'Comunidad UAL · Perfiles verificados',
        trustNoticeWelcome: 'Verificamos tu correo UAL para conectar con tu comunidad.',
        trustNoticeForm:
          'Verificamos tu correo institucional para que este sea un espacio seguro para la comunidad universitaria.',
        eyebrow: 'Cada viaje cuenta',
        visualTitle: 'Tu campus, mejor conectado.',
        visualDescription:
          'De casa al campus, comparte camino con personas que van en tu misma dirección.',
        back: 'Volver',
        language: 'Idioma',
      },
      welcome: {
        title: 'Te damos la bienvenida',
        createAccount: 'Crear mi cuenta',
        alreadyHaveAccount: 'Ya tengo cuenta',
      },
      accountCreated: {
        title: '¡Cuenta creada con éxito!',
        verifiedTitle: '¡Correo verificado!',
        subtitle:
          'Ya formas parte de Carpooling UAL. Todo listo para empezar a compartir tus trayectos.',
        verifiedSubtitle: 'Ya puedes buscar un viaje o compartir el tuyo con la comunidad.',
        exploreButton: 'Empezar a explorar',
        laterButton: 'Entrar más tarde',
      },
      emailSuggestions: {
        label: 'Sugerencias de correo',
        students: 'Estudiantes',
        staff: 'Personal',
      },
      login: { emailLabel: 'Correo electrónico' },
      password: { show: 'Mostrar contraseña', hide: 'Ocultar contraseña' },
      validation: {
        emailRequired: 'Introduce tu correo electrónico.',
        emailInvalid: 'Introduce un correo válido.',
        emailDomain: 'Usa tu correo de la Universidad de Almería.',
        nameInvalid: 'Usa solo letras; entre palabras, un espacio, un guion o un apóstrofo.',
      },
      newPassword: {
        mismatchError: 'Las contraseñas no coinciden',
        confirmError: 'Repite la contraseña nueva.',
        confirmRequired: 'Repite tu nueva contraseña.',
      },
      errors: {
        invalidCredentials: 'Correo o contraseña incorrectos.',
        unavailable: 'El servicio no está disponible ahora mismo. Inténtalo más tarde.',
        invalidCode: 'Ese código no es válido. Revisa los 6 dígitos o pide uno nuevo.',
        tooManyAttempts: 'Has fallado demasiadas veces. Pide un código nuevo.',
        passwordUnchanged: 'La contraseña nueva tiene que ser distinta de la actual.',
        emailRegistered: 'Ya hay una cuenta con este correo.',
      },
    },
  },
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
    globalThis.localStorage?.removeItem('carpooling_language');
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
  ]);
}

export function provideTranslocoTestingSupport(
  translations: Record<string, Record<string, unknown>> = {},
): EnvironmentProviders {
  return provideTestingTransloco(translations);
}
