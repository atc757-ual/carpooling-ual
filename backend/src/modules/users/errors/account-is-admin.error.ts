import { BusinessError } from '../../../shared/errors/business-error';

// La cuenta de un administrador activo no se inhabilita: antes se le retira
// el perfil de administrador (así nunca se queda la plataforma sin nadie que
// la gestione). La capa API lo traduce a un 409 (ACCOUNT_IS_ADMIN)
export class AccountIsAdminError extends BusinessError {
  constructor() {
    super(
      'ACCOUNT_IS_ADMIN',
      'conflict',
      'Remove the administrator profile before disabling this account',
    );
  }
}
