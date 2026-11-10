import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { PassengerTrip } from '../my-trips/trip-entries';

// Una solicitud del pasajero con su viaje, para los tests
export function passengerTrip(
  status: SeatRequest['status'],
  tripStatus: Trip['status'],
  extra: Partial<SeatRequest> = {},
): PassengerTrip {
  return {
    request: {
      id: 'r1',
      trip: { id: 't1' },
      passenger: { id: 'p1', name: 'Mario Pérez' },
      status,
      isPriority: false,
      seats: 2,
      requestedAt: '2099-01-14T10:00:00.000Z',
      answeredAt: null,
      cancelledAt: null,
      vehiclePlate: status === 'accepted' ? '1234BCD' : null,
      ...extra,
    },
    trip: {
      id: 't1',
      departureAt: '2099-01-15T06:40:00.000Z',
      offeredSeats: 3,
      availableSeats: 1,
      maxDetourMin: 10,
      vehicleId: 'v1',
      status: tripStatus,
      origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
      destination: { type: 'Point', coordinates: [-2.4, 36.83] },
      originName: 'Roquetas de Mar',
      destinationName: 'Campus UAL · Parking P1 (Sur)',
      isLocationApproximate: false,
      vehicle: null,
      driver: {
        id: 'd1',
        name: 'Lucía Cortés',
        avatarKey: null,
        preferences: { conversation: null, music: null, smoking: null, pets: null },
        tripCount: 0,
        rating: null,
      },
    },
  };
}
