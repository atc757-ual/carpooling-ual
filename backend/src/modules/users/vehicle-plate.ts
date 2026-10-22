// Matrícula española. Se guarda normalizada (mayúsculas, sin espacios ni
// guiones) para que "1234 abc" y "1234-ABC" sean la misma matrícula.
export function normalizePlate(rawPlate: string): string {
  return rawPlate.toUpperCase().replace(/[\s-]/g, '');
}

// Dos formatos, sobre la matrícula ya normalizada:
// - actual (desde 2000): 4 cifras + 3 consonantes, sin vocales, Ñ ni Q
// - provincial anterior, aún en circulación: provincia + cifras + letras
//   (p. ej. AL1234AB, M1234Z)
export const SPANISH_PLATE_PATTERN =
  /^(?:\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}|[A-Z]{1,2}\d{4}[A-Z]{0,2})$/;

export function isValidPlate(plate: string): boolean {
  return SPANISH_PLATE_PATTERN.test(plate);
}
