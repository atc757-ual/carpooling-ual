import { CampusParking } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import {
  buildStops,
  estimateDriverImpact,
  formatDateLabel,
  toDepartureAt,
  toPublishTripRequest,
} from './publish-trip.utils';

const P1: CampusParking = {
  id: 'p1',
  name: 'Parking P1',
  location: { type: 'Point', coordinates: [-2.4045, 36.8322] },
};
const ROQUETAS = {
  id: 'roq',
  name: 'Roquetas de Mar',
  locality: 'Roquetas',
  coordinates: [-2.6, 36.76],
} as SearchPlace;

describe('publish-trip utils', () => {
  it('formats the dates for the API and the summary', () => {
    expect(toDepartureAt('2099-01-15', '07:40')).toBe(new Date(2099, 0, 15, 7, 40).toISOString());
    expect(formatDateLabel('2099-01-15')).toContain('15');
    expect(formatDateLabel('')).toBe('');
  });

  it('builds the stops with the approximate arrival, in either direction', () => {
    const toCampus = buildStops(ROQUETAS, P1, { isToCampus: true, time: '07:40' });

    expect(toCampus[0]).toEqual({ name: 'Roquetas de Mar', detail: 'Roquetas', time: '07:40' });
    expect(toCampus[1]).toEqual({ name: 'Campus UAL', detail: 'Parking P1', time: '08:20' });

    const fromCampus = buildStops(ROQUETAS, P1, { isToCampus: false, time: '14:00' });

    expect(fromCampus[0]).toEqual({ name: 'Campus UAL', detail: 'Parking P1', time: '14:00' });
    expect(fromCampus[1].name).toBe('Roquetas de Mar');
  });

  it('multiplies what one trip saves by the seats offered', () => {
    const one = estimateDriverImpact(ROQUETAS, P1, 1);
    const three = estimateDriverImpact(ROQUETAS, P1, 3);

    expect(three?.seats).toBe(3);
    expect(three?.km).toBe((one?.km ?? 0) * 3);
  });

  it('has nothing to save from the campus itself', () => {
    const atCampus = { ...ROQUETAS, coordinates: P1.location.coordinates } as SearchPlace;

    expect(estimateDriverImpact(atCampus, P1, 2)).toBeNull();
  });

  it('builds the API request in either direction', () => {
    const offer = {
      isToCampus: true,
      date: '2099-01-15',
      time: '07:40',
      vehicleId: 'v1',
      seats: 2,
      maxDetourMin: 10,
    };

    expect(toPublishTripRequest(ROQUETAS, P1, offer)).toEqual({
      vehicleId: 'v1',
      origin: { type: 'Point', coordinates: ROQUETAS.coordinates },
      destination: P1.location,
      departureAt: toDepartureAt('2099-01-15', '07:40'),
      offeredSeats: 2,
      maxDetourMin: 10,
      originName: 'Roquetas de Mar',
      destinationName: 'Campus UAL · Parking P1',
    });
    expect(toPublishTripRequest(ROQUETAS, P1, { ...offer, isToCampus: false })).toEqual(
      expect.objectContaining({
        origin: P1.location,
        originName: 'Campus UAL · Parking P1',
        destinationName: 'Roquetas de Mar',
      }),
    );
  });
});
