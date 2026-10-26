import { BusinessError } from '../../../shared/errors/business-error';

// Al recuperar la contraseña, la nueva es igual a la actual. Solo se comprueba
// con un código correcto: sin él, nadie puede usarlo para probar contraseñas.
// La capa API lo traduce a un 400 (PASSWORD_UNCHANGED)
export class PasswordUnchangedError extends BusinessError {
  constructor() {
    super(
      'PASSWORD_UNCHANGED',
      'invalid',
      'The new password must be different from the current one',
    );
  }
}
