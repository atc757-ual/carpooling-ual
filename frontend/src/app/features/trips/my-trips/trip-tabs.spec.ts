import { DriverTrip, Trip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest, SeatRequestStatus } from '../../../core/models/seat-request.model';
import {
  driverTripTab,
  isTripsTab,
  passengerRequestLabel,
  passengerTripTab,
  TRIPS_TABS,
} from './trip-tabs';

const trip = (status: TripStatus): Trip => ({ status }) as Trip;
const request = (status: SeatRequestStatus, rejectionReason?: string): SeatRequest =>
  ({ status, rejectionReason }) as SeatRequest;

describe('trip tabs', () => {
  it('names the last tab for both roles: not only cancelled trips end there', () => {
    expect(TRIPS_TABS.map(({ label }) => label)).toEqual([
      'Próximos',
      'Anteriores',
      'No realizados',
    ]);
  });

  it('puts each trip of the driver in its tab', () => {
    const tabs = (['published', 'confirmed', 'in_progress', 'finished', 'cancelled'] as const).map(
      (status) => driverTripTab({ status } as DriverTrip),
    );
    expect(tabs).toEqual(['upcoming', 'upcoming', 'upcoming', 'past', 'cancelled']);
  });

  it('puts each request of the passenger in its tab', () => {
    expect(passengerTripTab(request('pending'), trip('published'))).toBe('upcoming');
    expect(passengerTripTab(request('accepted'), trip('in_progress'))).toBe('upcoming');
    expect(passengerTripTab(request('accepted'), trip('finished'))).toBe('past');
    expect(passengerTripTab(request('accepted'), trip('cancelled'))).toBe('cancelled');
    expect(passengerTripTab(request('pending'), trip('finished'))).toBe('cancelled');
    for (const status of ['rejected', 'expired', 'cancelled'] as const) {
      expect(passengerTripTab(request(status), trip('confirmed'))).toBe('cancelled');
    }
  });

  it('labels each request, with the reason when it did not happen', () => {
    const label = (status: SeatRequestStatus, tripStatus: TripStatus, reason?: string): string =>
      passengerRequestLabel(request(status, reason), trip(tripStatus));

    expect(label('pending', 'published')).toBe('Pendiente');
    expect(label('accepted', 'confirmed')).toBe('Confirmada');
    expect(label('accepted', 'finished')).toBe('Realizado');
    expect(label('accepted', 'cancelled')).toBe('Viaje cancelado');
    expect(label('rejected', 'confirmed')).toBe('No aceptada');
    expect(label('rejected', 'confirmed', 'trip_full')).toBe('Viaje completo');
    expect(label('expired', 'published')).toBe('Caducada');
    expect(label('cancelled', 'published')).toBe('Cancelada');
    expect(label('cancelled', 'in_progress', 'no_show')).toBe('No te presentaste');
  });

  it('tells a tab from any other value', () => {
    expect(['upcoming', 'past', 'cancelled', 'later', undefined].map(isTripsTab)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
