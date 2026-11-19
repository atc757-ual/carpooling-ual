import { translate } from '@jsverse/transloco';

// Textos de constantes de módulo (mapas de etiquetas, listas de opciones):
// se evalúan al importar, antes de que haya diccionario, así que cada
// propiedad traduce su clave al leerse (y sale en el idioma activo)

// { good: 'clave', … } → { good: 'Encaja muy bien', … } al leer cada una
export function lazyLabels<K extends string>(
  keys: Readonly<Record<K, string>>,
): Readonly<Record<K, string>> {
  const labels = {} as Record<K, string>;
  for (const [name, key] of Object.entries(keys) as [K, string][]) {
    Object.defineProperty(labels, name, { get: () => translate(key), enumerable: true });
  }
  return labels;
}

// Añade a un objeto (una opción de una lista) sus textos, traducidos al leerlos
export function withLazyLabels<T extends object, K extends string>(
  item: T,
  keys: Readonly<Record<K, string>>,
): T & Readonly<Record<K, string>> {
  for (const [name, key] of Object.entries(keys) as [K, string][]) {
    Object.defineProperty(item, name, { get: () => translate(key), enumerable: true });
  }
  return item as T & Readonly<Record<K, string>>;
}

// Una lista de textos (p. ej. los pasos de un indicador): cada posición
// traduce su clave al leerse
export function lazyList(keys: readonly string[]): readonly string[] {
  const list: string[] = [];
  keys.forEach((key, index) => {
    Object.defineProperty(list, index, { get: () => translate(key), enumerable: true });
  });
  return list;
}
