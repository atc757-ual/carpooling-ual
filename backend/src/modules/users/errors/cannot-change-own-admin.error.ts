import { BusinessError } from '../../../shared/errors/business-error';

// Un administrador no puede retirarse a sí mismo (evita quedarse fuera por
// error): lo hace otro administrador. La capa API lo traduce a un 409
// (CANNOT_CHANGE_OWN_ADMIN)
export class CannotChangeOwnAdminError extends BusinessError {
  constructor() {
    super(
      'CANNOT_CHANGE_OWN_ADMIN',
      'conflict',
      'Administrators cannot remove their own administrator profile',
    );
  }
}
