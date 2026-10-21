import { ValueTransformer } from 'typeorm';

// PostgreSQL devuelve las columnas numeric como texto ("4.80") para no perder
// precisión. Para valores pequeños como las valoraciones (1.00-5.00) un number
// basta, así que este transformador lo convierte al leer de la base de datos.
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
