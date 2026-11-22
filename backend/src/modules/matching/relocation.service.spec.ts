import type { Point } from 'typeorm';
import { TRIP_CANCELLED_REASON } from '../requests/request-status';
import type { RequestsService } from '../requests/requests.service';
import { NotRequestPassengerError } from '../requests/errors/not-request-passenger.error';
import type { TripsService } from '../trips/trips.service';
import { RequestNotRelocatableError } from './errors/request-not-relocatable.error';
import type { MatchingService, TripMatch } from './matching.service';
import {
  isRelocatable,
  madridDay,
  OPTIONS_MARGIN_MIN,
  RELOCATION_WINDOW_MIN,
  RelocationService,
} from './relocation.service';
import type { SeatRequest } from '../requests/entities/seat-request.entity';

const HOME: Point = { type: 'Point', coordinates: [-2.46, 36.84] };
const CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const DEPARTURE = new Date('2026-11-23T07:30:00.000Z');
const MINUTE_MS = 60_000;

function cancelledRequest(overrides: Partial<SeatRequest> = {}): SeatRequest {
  return {
    id: 'r1',
    passengerId: 'pia',
    tripId: 't-cancelled',
    status: 'cancelled',
    rejectionReason: TRIP_CANCELLED_REASON,
    cancelledAt: new Date(Date.now() - 5 * MINUTE_MS),
    direction: 'to-campus',
    pickupLocation: HOME,
    seats: 2,
    ...overrides,
  } as SeatRequest;
}

// Un viaje compatible que sale a esos minutos del cancelado
function match(
  tripId: string,
  minutesFromCancelled: number,
  stop: object | null = null,
): TripMatch {
  return {
    match: {
      candidate: {
        tripId,
        stop,
        departureAt: new Date(
          DEPARTURE.getTime() + minutesFromCancelled * MINUTE_MS,
        ),
      },
    },
  } as unknown as TripMatch;
}

describe('RelocationService', () => {
  let get: jest.Mock;
  let findMatches: jest.Mock;
  let service: RelocationService;

  // La primera búsqueda es la de su horario; la segunda, la de todo el día
  function givenMatches(onTime: TripMatch[], sameDay: TripMatch[]): void {
    findMatches.mockImplementation((_passenger, { marginMin }) =>
      Promise.resolve(marginMin === OPTIONS_MARGIN_MIN ? onTime : sameDay),
    );
  }

  beforeEach(() => {
    get = jest.fn().mockResolvedValue({ request: cancelledRequest() });
    findMatches = jest.fn().mockResolvedValue([]);
    service = new RelocationService(
      { get } as unknown as RequestsService,
      {
        getById: jest.fn().mockResolvedValue({
          trip: {
            id: 't-cancelled',
            origin: HOME,
            destination: CAMPUS,
            departureAt: DEPARTURE,
          },
        }),
      } as unknown as TripsService,
      { findMatches } as unknown as MatchingService,
    );
  });

  it('looks for trips the same way, to the same parking, with the seats and ±20 min of the cancelled one', async () => {
    await service.findOptions('pia', 'r1');

    expect(findMatches).toHaveBeenCalledWith('pia', {
      place: HOME,
      campus: CAMPUS,
      direction: 'to-campus',
      timeReference: 'departure',
      seats: 2,
      desiredAt: DEPARTURE,
      marginMin: OPTIONS_MARGIN_MIN,
    });
  });

  it('also looks for the rest of that day in Madrid, on the same route', async () => {
    await service.findOptions('pia', 'r1');

    const { start, end } = madridDay(DEPARTURE);
    expect(findMatches).toHaveBeenCalledWith(
      'pia',
      expect.objectContaining({
        place: HOME,
        desiredAt: new Date((start.getTime() + end.getTime()) / 2),
        marginMin: (end.getTime() - start.getTime()) / 2 / MINUTE_MS,
      }),
    );
  });

  it('puts apart the trip that matches exactly: ±15 min and at the passenger point', async () => {
    const atStop = match('t-stop', 2, { id: 's1' });
    const late = match('t-late', 18);
    const exact = match('t-exact', 5);
    givenMatches([atStop, late, exact], []);

    expect(await service.findOptions('pia', 'r1')).toEqual({
      exactMatch: exact,
      matches: [atStop, late],
      sameDayMatches: [],
    });
  });

  it('gives the rest of the day apart, without the ones already on time, earliest first', async () => {
    const onTime = match('t-on-time', 10);
    const evening = match('t-evening', 600);
    const noon = match('t-noon', 270);
    givenMatches([onTime], [match('t-on-time', 10), evening, noon]);

    expect(await service.findOptions('pia', 'r1')).toEqual({
      exactMatch: onTime,
      matches: [],
      sameDayMatches: [noon, evening],
    });
  });

  it('on the way back, searches from the campus', async () => {
    get.mockResolvedValue({
      request: cancelledRequest({ direction: 'from-campus' }),
    });

    await service.findOptions('pia', 'r1');

    expect(findMatches).toHaveBeenCalledWith(
      'pia',
      expect.objectContaining({
        place: CAMPUS,
        campus: HOME,
        direction: 'from-campus',
      }),
    );
  });

  it('only for a request cancelled by its driver in the last 30 minutes', async () => {
    for (const request of [
      cancelledRequest({ rejectionReason: null }),
      cancelledRequest({ status: 'accepted' }),
      cancelledRequest({
        cancelledAt: new Date(
          Date.now() - (RELOCATION_WINDOW_MIN + 1) * MINUTE_MS,
        ),
      }),
    ]) {
      get.mockResolvedValue({ request });
      await expect(service.findOptions('pia', 'r1')).rejects.toBeInstanceOf(
        RequestNotRelocatableError,
      );
    }
    expect(findMatches).not.toHaveBeenCalled();
  });

  it('only for the passenger of the request (not the driver)', async () => {
    await expect(service.findOptions('dan', 'r1')).rejects.toBeInstanceOf(
      NotRequestPassengerError,
    );
    expect(findMatches).not.toHaveBeenCalled();
  });
});

describe('isRelocatable', () => {
  const now = new Date('2026-11-22T18:00:00Z');

  it('is relocatable up to 30 minutes after the driver cancelled', () => {
    const at = (minutesAgo: number) =>
      cancelledRequest({
        cancelledAt: new Date(now.getTime() - minutesAgo * MINUTE_MS),
      });

    expect(isRelocatable(at(30), now)).toBe(true);
    expect(isRelocatable(at(31), now)).toBe(false);
    expect(isRelocatable(cancelledRequest({ cancelledAt: null }), now)).toBe(
      false,
    );
  });
});

describe('madridDay', () => {
  it('goes from midnight to midnight in Madrid, in winter and in summer', () => {
    // 00:30 del 24 en Madrid: ya es el día 24
    expect(madridDay(new Date('2026-11-23T23:30:00Z'))).toEqual({
      start: new Date('2026-11-23T23:00:00Z'),
      end: new Date('2026-11-24T23:00:00Z'),
    });
    expect(madridDay(new Date('2026-07-01T10:00:00Z'))).toEqual({
      start: new Date('2026-06-30T22:00:00Z'),
      end: new Date('2026-07-01T22:00:00Z'),
    });
  });
});
