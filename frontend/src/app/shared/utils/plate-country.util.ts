// Países de la matrícula, los mismos que la API (vehicle-plate.ts): la UE, el
// EEE y Suiza. Cada uno con su nombre y la letra de la franja azul (el
// distintivo del país en la placa: E, P, F, D…)
export interface PlateCountryOption {
  code: string;
  name: string;
  sign: string;
}

export const DEFAULT_PLATE_COUNTRY = 'ES';

// España primero y el resto por orden alfabético
export const PLATE_COUNTRY_OPTIONS: readonly PlateCountryOption[] = [
  { code: 'ES', name: 'España', sign: 'E' },
  { code: 'DE', name: 'Alemania', sign: 'D' },
  { code: 'AT', name: 'Austria', sign: 'A' },
  { code: 'BE', name: 'Bélgica', sign: 'B' },
  { code: 'BG', name: 'Bulgaria', sign: 'BG' },
  { code: 'CY', name: 'Chipre', sign: 'CY' },
  { code: 'HR', name: 'Croacia', sign: 'HR' },
  { code: 'DK', name: 'Dinamarca', sign: 'DK' },
  { code: 'SK', name: 'Eslovaquia', sign: 'SK' },
  { code: 'SI', name: 'Eslovenia', sign: 'SLO' },
  { code: 'EE', name: 'Estonia', sign: 'EST' },
  { code: 'FI', name: 'Finlandia', sign: 'FIN' },
  { code: 'FR', name: 'Francia', sign: 'F' },
  { code: 'GR', name: 'Grecia', sign: 'GR' },
  { code: 'HU', name: 'Hungría', sign: 'H' },
  { code: 'IE', name: 'Irlanda', sign: 'IRL' },
  { code: 'IS', name: 'Islandia', sign: 'IS' },
  { code: 'IT', name: 'Italia', sign: 'I' },
  { code: 'LV', name: 'Letonia', sign: 'LV' },
  { code: 'LI', name: 'Liechtenstein', sign: 'FL' },
  { code: 'LT', name: 'Lituania', sign: 'LT' },
  { code: 'LU', name: 'Luxemburgo', sign: 'L' },
  { code: 'MT', name: 'Malta', sign: 'M' },
  { code: 'NO', name: 'Noruega', sign: 'N' },
  { code: 'NL', name: 'Países Bajos', sign: 'NL' },
  { code: 'PL', name: 'Polonia', sign: 'PL' },
  { code: 'PT', name: 'Portugal', sign: 'P' },
  { code: 'CZ', name: 'República Checa', sign: 'CZ' },
  { code: 'RO', name: 'Rumanía', sign: 'RO' },
  { code: 'SE', name: 'Suecia', sign: 'S' },
  { code: 'CH', name: 'Suiza', sign: 'CH' },
];

const SIGNS = new Map(PLATE_COUNTRY_OPTIONS.map(({ code, sign }) => [code, sign]));

// Matrícula española actual (1234BCD) o provincial anterior (AL1234AB)
const SPANISH_PLATE = /^(?:\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}|[A-Z]{1,2}\d{4}[A-Z]{0,2})$/;
// Las de otros países: de 2 a 10 letras y cifras, con al menos una cifra
const FOREIGN_PLATE = /^(?=.*\d)[A-Z\d]{2,10}$/;

// La letra de la franja azul (España, si el país no se conoce)
export function plateSign(country: string | undefined): string {
  return SIGNS.get(country ?? DEFAULT_PLATE_COUNTRY) ?? 'E';
}

// Como la guarda la API: mayúsculas, sin espacios ni guiones
export function normalizePlate(rawPlate: string): string {
  return rawPlate.replaceAll(/[\s-]/g, '').toUpperCase();
}

export function isValidPlate(rawPlate: string, country: string): boolean {
  const pattern = country === DEFAULT_PLATE_COUNTRY ? SPANISH_PLATE : FOREIGN_PLATE;
  return pattern.test(normalizePlate(rawPlate));
}
