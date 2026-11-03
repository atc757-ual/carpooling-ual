// Matrícula del vehículo. Se guarda normalizada (mayúsculas, sin espacios ni
// guiones) para que "1234 abc" y "1234-ABC" sean la misma matrícula.
export function normalizePlate(rawPlate: string): string {
  return rawPlate.toUpperCase().replace(/[\s-]/g, '');
}

// Países cuyas matrículas circulan libremente por España: los 27 de la UE,
// los del EEE (Noruega, Islandia y Liechtenstein) y Suiza. Código ISO 3166-1
export const PLATE_COUNTRIES = [
  'ES',
  'AT',
  'BE',
  'BG',
  'CH',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IS',
  'IT',
  'LI',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
] as const;
export type PlateCountry = (typeof PLATE_COUNTRIES)[number];

export const DEFAULT_PLATE_COUNTRY: PlateCountry = 'ES';

// Dos formatos españoles, sobre la matrícula ya normalizada:
// - actual (desde 2000): 4 cifras + 3 consonantes, sin vocales, Ñ ni Q
// - provincial anterior, aún en circulación: provincia + cifras + letras
//   (p. ej. AL1234AB, M1234Z)
export const SPANISH_PLATE_PATTERN =
  /^(?:\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}|[A-Z]{1,2}\d{4}[A-Z]{0,2})$/;

// Las de otros países, con una regla común: de 2 a 10 letras y cifras, con al
// menos una cifra (cada país tiene su formato y hay matrículas personalizadas)
export const FOREIGN_PLATE_PATTERN = /^(?=.*\d)[A-Z\d]{2,10}$/;

export function isValidPlate(
  plate: string,
  country: string = DEFAULT_PLATE_COUNTRY,
): boolean {
  const pattern =
    country === DEFAULT_PLATE_COUNTRY
      ? SPANISH_PLATE_PATTERN
      : FOREIGN_PLATE_PATTERN;
  return pattern.test(plate);
}
