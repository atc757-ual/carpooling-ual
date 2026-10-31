import { BusinessError } from '../../../shared/errors/business-error';

// Ya existe una reseña de este autor para ese destinatario en el viaje (RF-22:
// una sola reseña, que no se edita ni se borra). La capa API lo traduce a un
// 409 (REVIEW_ALREADY_EXISTS)
export class ReviewAlreadyExistsError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly targetId: string,
  ) {
    super(
      'REVIEW_ALREADY_EXISTS',
      'conflict',
      `A review for target ${targetId} in trip ${tripId} already exists`,
    );
  }
}
