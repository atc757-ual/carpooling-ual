// Idiomas de la app: el del usuario decide el de sus correos y sus avisos
// push. El español es el de partida (y el que vale en los textos legales)
export const APP_LANGUAGES = ['es', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'es';

// La configuración regional de las fechas de los correos
export const LANGUAGE_LOCALES: Record<AppLanguage, string> = {
  es: 'es-ES',
  en: 'en-GB',
};
