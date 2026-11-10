import { CampusParking } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import {
  buildStops,
  estimateDriverImpact,
  formatDateLabel,
  estimateDepartureAt,
  estimateDepartureTime,
  toIsoDateTime,
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
    expect(toIsoDateTime('2099-01-15', '07:40')).toBe(new Date(2099, 0, 15, 7, 40).toISOString());
    expect(formatDateLabel('2099-01-15')).toContain('15');
    expect(formatDateLabel('')).toBe('');
  });

  // Hacia el campus se elige la llegada: sale con margen para el trayecto
  // (40 min) y el desvío máximo (10 min)
  it('leaves early enough to arrive on time even after picking someone up', () => {
    expect(estimateDepartureTime(ROQUETAS, P1, { time: '08:20', maxDetourMin: 10 })).toBe('07:30');
  });

  // Llegar a las 00:20 es salir el día anterior
  it('keeps the date of a departure before midnight', () => {
    const departure = estimateDepartureAt(ROQUETAS, P1, {
      date: '2099-01-15',
      time: '00:20',
      maxDetourMin: 10,
    });

    expect(departure).toEqual(new Date(2099, 0, 14, 23, 30));
  });

  it('builds the stops in either direction', () => {
    const toCampus = buildStops(ROQUETAS, P1, {
      isToCampus: true,
      time: '08:20',
      maxDetourMin: 10,
    });

    expect(toCampus[0]).toEqual({ name: 'Roquetas de Mar', detail: 'Roquetas', time: '07:30' });
    expect(toCampus[1]).toEqual({ name: 'Campus UAL', detail: 'Parking P1', time: '08:20' });

    // Ya publicado, la salida que calculó el backend
    const published = buildStops(ROQUETAS, P1, {
      isToCampus: true,
      time: '08:20',
      maxDetourMin: 10,
      departureTime: '07:34',
    });
    expect(published[0].time).toBe('07:34');

    const fromCampus = buildStops(ROQUETAS, P1, {
      isToCampus: false,
      time: '14:00',
      maxDetourMin: 10,
    });

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
      arrivalAt: toIsoDateTime('2099-01-15', '07:40'),
      offeredSeats: 2,
      maxDetourMin: 10,
      originName: 'Roquetas de Mar',
      destinationName: 'Campus UAL · Parking P1',
    });
    expect(toPublishTripRequest(ROQUETAS, P1, { ...offer, isToCampus: false })).toEqual(
      expect.objectContaining({
        origin: P1.location,
        departureAt: toIsoDateTime('2099-01-15', '07:40'),
        originName: 'Campus UAL · Parking P1',
        destinationName: 'Roquetas de Mar',
      }),
    );
  });
});
