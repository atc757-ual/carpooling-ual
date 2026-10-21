import { BusinessError } from '../../../shared/errors/business-error';

// No existe ningún usuario con ese id. La capa API lo traduce a un 404
// (USER_NOT_FOUND)
export class UserNotFoundError extends BusinessError {
  constructor(readonly userId: string) {
    super('USER_NOT_FOUND', 'not_found', `There is no user with id ${userId}`);
  }
}
