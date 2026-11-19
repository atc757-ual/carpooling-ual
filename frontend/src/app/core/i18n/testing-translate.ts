import esDictionary from '../../../../public/i18n/es.json';
import { Translate } from './translate';

// Para los tests de funciones puras que reciben un `Translate`: traduce con el
// diccionario español real y sus parámetros (`{{ name }}`), como Transloco.
// Una clave que no existe falla, para que el test lo detecte
export const translateEs: Translate = (key, params = {}) => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      esDictionary,
    );
  if (typeof value !== 'string') {
    throw new Error(`Missing translation key: ${key}`);
  }
  return value.replaceAll(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params[name] ?? ''));
};
