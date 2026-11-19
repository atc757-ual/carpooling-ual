import { translate } from '@jsverse/transloco';
import { TripStatus } from '../../core/models/driver.model';

// El estado del viaje en texto (guía, «Estados»: nunca solo con color). «finished»
// es «Realizado», como la plaza del pasajero: el viaje se hizo
export function tripStatusLabel(status: TripStatus): string {
  return translate(`labels.tripStatus.${status}`);
}
