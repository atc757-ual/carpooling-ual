import { BusinessError } from '../../../shared/errors/business-error';

// Un administrador no puede inhabilitar su propia cuenta (se quedaría fuera):
// lo hace otro administrador. La capa API lo traduce a un 409
// (CANNOT_DISABLE_OWN_ACCOUNT)
export class CannotDisableOwnAccountError extends BusinessError {
  constructor() {
    super(
      'CANNOT_DISABLE_OWN_ACCOUNT',
      'conflict',
      'Administrators cannot disable their own account',
    );
  }
}
