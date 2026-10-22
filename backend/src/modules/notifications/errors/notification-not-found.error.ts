import { BusinessError } from '../../../shared/errors/business-error';

// No existe el aviso, o es de otro usuario (no se distingue: no se revela que
// existe). La capa API lo traduce a un 404 (NOTIFICATION_NOT_FOUND)
export class NotificationNotFoundError extends BusinessError {
  constructor(readonly notificationId: string) {
    super(
      'NOTIFICATION_NOT_FOUND',
      'not_found',
      `There is no notification with id ${notificationId}`,
    );
  }
}
