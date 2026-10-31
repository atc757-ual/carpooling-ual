import { BusinessError } from '../../../shared/errors/business-error';
import { REVIEW_WINDOW_DAYS } from '../entities/review.entity';

// El plazo de 7 días tras la finalización del viaje ya ha vencido (RF-22). La
// capa API lo traduce a un 409 (REVIEW_WINDOW_CLOSED)
export class ReviewWindowClosedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'REVIEW_WINDOW_CLOSED',
      'conflict',
      `The ${REVIEW_WINDOW_DAYS}-day review window for trip ${tripId} has closed`,
    );
  }
}

