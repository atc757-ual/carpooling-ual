import { BusinessError } from '../../../shared/errors/business-error';

// El usuario ya denunció ese mensaje del chat. La capa API lo traduce a un 409
// (MESSAGE_ALREADY_REPORTED)
export class MessageAlreadyReportedError extends BusinessError {
  constructor(readonly messageId: string) {
    super(
      'MESSAGE_ALREADY_REPORTED',
      'conflict',
      `You already reported message ${messageId}`,
    );
  }
}
