import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Nombre de persona, igual que la API (POST /api/auth/register): letras de
// cualquier idioma (con tildes, ñ, ç…) y, entre ellas, un espacio, un guion o
// un apóstrofo (Ana-María, O'Connor). Sin números ni otros símbolos
const PERSON_NAME_PATTERN = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;
// Lo que no puede aparecer nunca en un nombre: todo menos letras, espacios,
// guiones y apóstrofos
const NOT_NAME_CHARACTERS = /[^\p{L}\s'’-]/gu;

// Para el campo mientras se escribe: quita números y símbolos (lo que queda
// lo comprueba personNameValidator, p. ej. dos guiones seguidos). Antes une
// las tildes escritas aparte a su letra, para no quitarlas
export function stripNameSymbols(name: string): string {
  return name.normalize('NFC').replace(NOT_NAME_CHARACTERS, '');
}

// Como lo guarda la API: tildes escritas aparte unidas a su letra (NFC), sin
// espacios en los extremos y uno solo entre palabras
export function normalizePersonName(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

// Devuelve { personName: true } si no es un nombre válido. El vacío lo
// comprueba Validators.required
export function personNameValidator(): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const name = normalizePersonName(control.value ?? '');
    return name === '' || PERSON_NAME_PATTERN.test(name) ? null : { personName: true };
  };
}
