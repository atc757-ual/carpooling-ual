export const SPANISH_PREFIX = '+34';

// Prefijos de la lista del teléfono con el país de su bandera (código ISO en
// minúsculas, como las clases de flag-icons: «fi fi-es»; theme/_flags.scss
// incluye solo estas): España (por defecto) y los países de donde suele venir
// la comunidad de la UAL (Erasmus, personal visitante), ordenados por prefijo
// después de España. +1 es Estados Unidos y Canadá (con la bandera de EE. UU.)
const PREFIX_COUNTRIES: readonly (readonly [prefix: string, country: string])[] = [
  [SPANISH_PREFIX, 'es'],
  ['+1', 'us'],
  ['+30', 'gr'],
  ['+31', 'nl'],
  ['+32', 'be'],
  ['+33', 'fr'],
  ['+36', 'hu'],
  ['+39', 'it'],
  ['+40', 'ro'],
  ['+41', 'ch'],
  ['+43', 'at'],
  ['+44', 'gb'],
  ['+45', 'dk'],
  ['+46', 'se'],
  ['+47', 'no'],
  ['+48', 'pl'],
  ['+49', 'de'],
  ['+51', 'pe'],
  ['+52', 'mx'],
  ['+54', 'ar'],
  ['+55', 'br'],
  ['+56', 'cl'],
  ['+57', 'co'],
  ['+58', 've'],
  ['+86', 'cn'],
  ['+90', 'tr'],
  ['+212', 'ma'],
  ['+213', 'dz'],
  ['+216', 'tn'],
  ['+351', 'pt'],
  ['+353', 'ie'],
  ['+358', 'fi'],
  ['+359', 'bg'],
  ['+370', 'lt'],
  ['+371', 'lv'],
  ['+380', 'ua'],
  ['+385', 'hr'],
  ['+386', 'si'],
  ['+420', 'cz'],
  ['+421', 'sk'],
  ['+591', 'bo'],
  ['+593', 'ec'],
  ['+595', 'py'],
  ['+598', 'uy'],
];

export const PHONE_PREFIXES: readonly string[] = PREFIX_COUNTRIES.map(([prefix]) => prefix);

// Código del país del prefijo, para su bandera ('' si no está en la lista)
export function getPrefixCountry(prefix: string): string {
  return PREFIX_COUNTRIES.find(([code]) => code === prefix)?.[1] ?? '';
}
