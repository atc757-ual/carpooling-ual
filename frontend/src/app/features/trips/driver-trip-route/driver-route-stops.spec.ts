import { SeatRequest } from '../../../core/models/seat-request.model';
import { formatTime } from '../../matching/trip-results';
import { buildDriverRouteStops } from './driver-route-stops';

const TRIP = {
  departureAt: '2099-01-15T07:00:00.000Z',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
  stops: [],
};

function accepted(name: string, extra: Partial<SeatRequest> = {}): SeatRequest {
  return {
    id: `r-${name}`,
    passenger: { id: `p-${name}`, name: `${name} Pérez` },
    status: 'accepted',
    ...extra,
  } as SeatRequest;
}

describe('buildDriverRouteStops', () => {
  it('goes from the start to the campus through each pickup point, with its time', () => {
    const stops = buildDriverRouteStops(
      TRIP,
      [accepted('Ana', { pickupName: 'Calle Real', pickupAt: '2099-01-15T07:12:00.000Z' })],
      30,
    );

    expect(stops).toEqual([
      { name: 'Roquetas de Mar', detail: 'Sales de aquí', time: formatTime(TRIP.departureAt) },
      {
        name: 'Calle Real',
        detail: 'Recoges a Ana',
        time: formatTime('2099-01-15T07:12:00.000Z'),
      },
      {
        name: 'Campus UAL · Parking P1 (Sur)',
        detail: 'Llegada aproximada',
        time: formatTime('2099-01-15T07:30:00.000Z'),
      },
    ]);
  });

  it('lists every stop with its time and who boards there', () => {
    const trip = {
      ...TRIP,
      stops: [
        {
          id: 's1',
          position: 0,
          name: 'Av. Cabo de Gata',
          location: { type: 'Point' as const, coordinates: [-2.44, 36.83] as [number, number] },
          estimatedAt: '2099-01-15T07:08:00.000Z',
        },
        {
          id: 's2',
          position: 1,
          name: 'Ctra. Sacramento',
          location: { type: 'Point' as const, coordinates: [-2.41, 36.83] as [number, number] },
          estimatedAt: '2099-01-15T07:15:00.000Z',
        },
      ],
    };

    const stops = buildDriverRouteStops(
      trip,
      [accepted('Ana', { stopId: 's1' }), accepted('Leo', { stopId: 's1' })],
      undefined,
    );

    expect(stops.slice(1, 3)).toEqual([
      {
        name: 'Av. Cabo de Gata',
        detail: 'Recoges a Ana y Leo',
        time: formatTime('2099-01-15T07:08:00.000Z'),
      },
      {
        name: 'Ctra. Sacramento',
        detail: 'Aún no sube nadie aquí',
        time: formatTime('2099-01-15T07:15:00.000Z'),
      },
    ]);
    expect(stops.at(-1)?.time).toBeUndefined();
  });
});
