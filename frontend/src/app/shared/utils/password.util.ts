import { ValidatorFn, Validators } from '@angular/forms';

// Longitud de la contraseña, la misma que exige el backend (@Length(8, 72)):
// bcrypt solo usa los 72 primeros bytes
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

// Validadores de una contraseña nueva (registro, recuperación y cambio)
export const NEW_PASSWORD_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(PASSWORD_MIN_LENGTH),
  Validators.maxLength(PASSWORD_MAX_LENGTH),
];
