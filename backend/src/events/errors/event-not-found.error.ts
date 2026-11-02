import { BusinessError } from '../../shared/errors/business-error';

// No existe el evento. La capa API lo traduce a un 404 (EVENT_NOT_FOUND)
export class EventNotFoundError extends BusinessError {
  constructor(readonly eventId: string) {
    super(
      'EVENT_NOT_FOUND',
      'not_found',
      'There is no event with id ' + eventId,
    );
  }
}
