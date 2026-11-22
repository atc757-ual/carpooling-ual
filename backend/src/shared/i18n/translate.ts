import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_LANGUAGES, type AppLanguage } from './app-language';

// Los textos de correos y push en cada idioma, en src/i18n/<idioma>.json (como
// los de la app, con {{ valor }} para lo que cambia). Se leen una vez al
// arrancar; nest-cli.json los copia al build (assets)
type Translations = { [key: string]: string | Translations };

function load(language: AppLanguage): Translations {
  const file = join(__dirname, '..', '..', 'i18n', `${language}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Translations;
}

const TRANSLATIONS = Object.fromEntries(
  APP_LANGUAGES.map((language) => [language, load(language)]),
) as Record<AppLanguage, Translations>;

// El texto de una clave («push.request_received.title») en ese idioma, con
// sus valores: translate('es', 'mail.greeting', { name: 'Ana' }) da
// «Hola, Ana:». Una clave que no existe es un error de programación: lanza
export function translate(
  language: AppLanguage,
  key: string,
  values: Record<string, string | number> = {},
): string {
  const text = key
    .split('.')
    .reduce<string | Translations | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      TRANSLATIONS[language],
    );
  if (typeof text !== 'string') {
    throw new Error(`Missing translation ${language}:${key}`);
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

// Las claves de todos los textos de un idioma («mail.greeting», …), para
// comprobar en los tests que los dos idiomas tienen las mismas
export function translationKeys(language: AppLanguage): string[] {
  const keysOf = (node: Translations, prefix: string): string[] =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [`${prefix}${key}`]
        : keysOf(value, `${prefix}${key}.`),
    );
  return keysOf(TRANSLATIONS[language], '');
}
