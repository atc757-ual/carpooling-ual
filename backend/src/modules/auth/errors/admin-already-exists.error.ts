import { BusinessError } from '../../../shared/errors/business-error';

// El comando create-admin solo crea el PRIMER administrador (RF-01): si ya hay
// alguno, los siguientes los asigna un administrador desde el panel (RF-25)
export class AdminAlreadyExistsError extends BusinessError {
  constructor() {
    super(
      'ADMIN_ALREADY_EXISTS',
      'conflict',
      'An administrator already exists: new administrators are assigned by an administrator (RF-25)',
    );
  }
}
