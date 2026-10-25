import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Teléfono en formato internacional, como lo espera la API (E.164): «+», el
// prefijo del país y el número. España por defecto: un número de 9 cifras que
// empieza por 6, 7, 8 o 9 se toma como español (+34). Para otros países (p. ej.
// Erasmus), con «+» o «00» y el prefijo. Como en el backend, se ignoran
// espacios, guiones y paréntesis: «612 345 678» y «+39 333 123 4567» valen

const SPANISH_PREFIX = '+34';
const SPANISH_NUMBER = /^[6-9]\d{8}$/;
const INTERNATIONAL_NUMBER = /^\+\d{8,15}$/;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, '');
  if (SPANISH_NUMBER.test(digits)) {
    return SPANISH_PREFIX + digits;
  }
  return digits.startsWith('00') ? `+${digits.slice(2)}` : digits;
}

// Devuelve { phone: true } si no es un número español ni internacional. El
// vacío lo comprueba Validators.required
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const phone = normalizePhone(control.value ?? '');
    return phone === '' || INTERNATIONAL_NUMBER.test(phone) ? null : { phone: true };
  };
}
