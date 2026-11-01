import type { ValueTransformer } from 'typeorm';

// PostgreSQL devuelve numeric y bigint como texto para no perder precisión;
// aquí los valores caben de sobra en un number
export const NUMERIC: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
