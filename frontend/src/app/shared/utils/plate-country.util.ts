import { appLocale } from '../../core/i18n/app-locale';
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
const PLATE_COUNTRIES: readonly { code: string; sign: string }[] = [
  { code: 'ES', sign: 'E' },
  { code: 'DE', sign: 'D' },
  { code: 'AT', sign: 'A' },
  { code: 'BE', sign: 'B' },
  { code: 'BG', sign: 'BG' },
  { code: 'CY', sign: 'CY' },
  { code: 'HR', sign: 'HR' },
  { code: 'DK', sign: 'DK' },
  { code: 'SK', sign: 'SK' },
  { code: 'SI', sign: 'SLO' },
  { code: 'EE', sign: 'EST' },
  { code: 'FI', sign: 'FIN' },
  { code: 'FR', sign: 'F' },
  { code: 'GR', sign: 'GR' },
  { code: 'HU', sign: 'H' },
  { code: 'IE', sign: 'IRL' },
  { code: 'IS', sign: 'IS' },
  { code: 'IT', sign: 'I' },
  { code: 'LV', sign: 'LV' },
  { code: 'LI', sign: 'FL' },
  { code: 'LT', sign: 'LT' },
  { code: 'LU', sign: 'L' },
  { code: 'MT', sign: 'M' },
  { code: 'NO', sign: 'N' },
  { code: 'NL', sign: 'NL' },
  { code: 'PL', sign: 'PL' },
  { code: 'PT', sign: 'P' },
  { code: 'CZ', sign: 'CZ' },
  { code: 'RO', sign: 'RO' },
  { code: 'SE', sign: 'S' },
  { code: 'CH', sign: 'CH' },
];

// Con el nombre del país en el idioma activo (Intl), que se lee al mostrarlo
export const PLATE_COUNTRY_OPTIONS: readonly PlateCountryOption[] = PLATE_COUNTRIES.map(
  ({ code, sign }) => ({
    code,
    sign,
    get name(): string {
      return new Intl.DisplayNames([appLocale()], { type: 'region' }).of(code) ?? code;
    },
  }),
);

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
