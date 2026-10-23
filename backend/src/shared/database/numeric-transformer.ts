import type { ValueTransformer } from 'typeorm';

// PostgreSQL devuelve las columnas numeric como texto (para no perder
// precisión): este transformador las convierte en número. Sirve para valores
// que caben de sobra en un número de JavaScript (p. ej. km con dos decimales)
export const NUMERIC_TO_NUMBER: ValueTransformer = {
  to: (value: number): number => value,
  from: Number,
};
