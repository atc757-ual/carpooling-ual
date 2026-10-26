import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { PHONE_PREFIXES, SPANISH_PREFIX } from './phone-prefixes';

// El teléfono se pide en dos campos: el prefijo del país (desplegable, España
// por defecto) y el número, solo con cifras. A la API se envía junto, en
// formato internacional (E.164): «+», el prefijo y el número (+34612345678)

// Móvil o fijo español: 9 cifras que empiezan por 6, 7, 8 o 9
const SPANISH_NUMBER = /^[6-9]\d{8}$/;
// E.164: como mucho 15 cifras con el prefijo; menos de 8 no es un teléfono
const MIN_TOTAL_DIGITS = 8;
const MAX_TOTAL_DIGITS = 15;

export interface SplitPhone {
  prefix: string;
  number: string;
}

// Solo las cifras de lo escrito en el número
export function toDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Si se pega o escribe un número completo en el campo del número (con «+» o
// «00» delante), separa el prefijo conocido más largo que encaje. Si no, deja
// el prefijo elegido y se queda con las cifras
export function splitPhone(value: string, currentPrefix: string): SplitPhone {
  const trimmed = value.trim();
  const isInternational = trimmed.startsWith('+') || trimmed.startsWith('00');
  const digits = toDigits(trimmed.startsWith('00') ? trimmed.slice(2) : trimmed);
  if (!isInternational) {
    return { prefix: currentPrefix, number: digits };
  }
  const match = [...PHONE_PREFIXES]
    .sort((a, b) => b.length - a.length)
    .find((code) => digits.startsWith(code.slice(1)));
  return match
    ? { prefix: match, number: digits.slice(match.length - 1) }
    : { prefix: currentPrefix, number: digits };
}

export function buildPhone(prefix: string, number: string): string {
  return prefix + toDigits(number);
}

// Para el campo del número: lee el prefijo del control hermano (prefixControl)
// y devuelve { phone: true } si el número no vale para ese país. El vacío lo
// comprueba Validators.required
export function phoneNumberValidator(prefixControl: string): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const number = toDigits(control.value ?? '');
    if (number === '') {
      return null;
    }
    const prefix = (control.parent?.get(prefixControl)?.value as string | undefined) ?? '';
    if (prefix === SPANISH_PREFIX) {
      return SPANISH_NUMBER.test(number) ? null : { phone: true };
    }
    const totalDigits = prefix.length - 1 + number.length;
    return totalDigits >= MIN_TOTAL_DIGITS && totalDigits <= MAX_TOTAL_DIGITS
      ? null
      : { phone: true };
  };
}
