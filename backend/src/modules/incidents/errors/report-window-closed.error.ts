import { BusinessError } from '../../../shared/errors/business-error';
import { AFTER_TRIP_REPORT_DAYS } from '../entities/incident.entity';

// El viaje no ha terminado o ya pasaron los 7 días para reportarlo. La capa
// API lo traduce a un 409 (REPORT_WINDOW_CLOSED)
export class ReportWindowClosedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'REPORT_WINDOW_CLOSED',
      'conflict',
      `Trip ${tripId} can only be reported in the ${AFTER_TRIP_REPORT_DAYS} days after it finishes`,
    );
  }
}
