import { Trip } from '../trips/entities/trip.entity';
import type { TripStatus } from '../trips/trip-status';
import { SeatRequest } from './entities/seat-request.entity';
import { noticeFor } from './request-changes';
import type { RequestEventType } from './request-changes';

// Reglas fijas de aviso de RF-19 para cada cambio de una solicitud: a quién
// se avisa y con qué tipo, según el cambio y el estado del viaje
const DRIVER = 'driver-id';
const PASSENGER = 'passenger-id';

function notice(type: RequestEventType, tripStatus: TripStatus) {
  const trip = { driverId: DRIVER, status: tripStatus } as Trip;
  const request = { passengerId: PASSENGER } as SeatRequest;
  return noticeFor(type, request, trip);
}

describe('noticeFor', () => {
  it.each<[RequestEventType, TripStatus, string, string]>([
    ['request.created', 'published', DRIVER, 'request_received'],
    ['request.accepted', 'confirmed', PASSENGER, 'request_accepted'],
    ['request.rejected', 'published', PASSENGER, 'request_rejected'],
    ['request.expired', 'published', PASSENGER, 'request_expired'],
    // Rechazada sola al iniciar el viaje
    ['request.rejected', 'in_progress', PASSENGER, 'request_rejected'],
    // El pasajero cancela antes del viaje (el viaje puede haberse reabierto)
    ['request.cancelled', 'published', DRIVER, 'request_cancelled'],
    ['request.cancelled', 'confirmed', DRIVER, 'request_cancelled'],
    // El pasajero abandona un viaje en curso (RF-23)
    ['request.cancelled', 'in_progress', DRIVER, 'passenger_left'],
    // La solicitud cae con el viaje cancelado
    ['request.cancelled', 'cancelled', PASSENGER, 'trip_cancelled'],
  ])(
    '%s with the trip %s: notifies %s with %s',
    (type, tripStatus, recipientId, noticeType) => {
      expect(notice(type, tripStatus)).toEqual({
        recipientId,
        type: noticeType,
      });
    },
  );

  it('notifies passenger with passenger_no_show when cancelled due to no_show', () => {
    const trip = { driverId: DRIVER, status: 'in_progress' } as Trip;
    const request = {
      passengerId: PASSENGER,
      rejectionReason: 'no_show',
    } as SeatRequest;
    expect(noticeFor('request.cancelled', request, trip)).toEqual({
      recipientId: PASSENGER,
      type: 'passenger_no_show',
    });
  });
});
