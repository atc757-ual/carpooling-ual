import { formatTime } from '../matching/trip-results';
import { buildLiveShareText, buildSeatsShareText, ShareRoute } from './trip-share-text';

const ROUTE: ShareRoute = {
  originName: 'Roquetas de Mar',
  destinationName: 'Campus · Parking 1',
  departureAt: '2026-11-16T07:30:00.000Z',
};
const TIME = formatTime(ROUTE.departureAt);

describe('trip share text', () => {
  it('announces the free seats with the route, day and time', () => {
    const text = buildSeatsShareText(ROUTE, 2);

    expect(text).toContain(
      'Tengo 2 plazas libres en mi coche: Roquetas de Mar → Campus · Parking 1',
    );
    expect(text).toContain('noviembre');
    expect(text).toContain(`a las ${TIME}`);
    expect(text).toContain('Búscalo en Carpooling UAL');
  });

  it('uses the singular for a single seat', () => {
    expect(buildSeatsShareText(ROUTE, 1)).toContain('Tengo 1 plaza libre en mi coche');
  });

  it('falls back to generic names when the trip has none', () => {
    const text = buildLiveShareText({ ...ROUTE, originName: null, destinationName: null });

    expect(text).toBe(
      `Voy conduciendo un viaje compartido de la UAL: Origen → Destino, salida a las ${TIME}.`,
    );
  });

  it('tells who drives and the car when a passenger shares the trip', () => {
    const text = buildLiveShareText(ROUTE, {
      name: 'Lucía',
      vehicleName: 'Seat Ibiza',
      plate: '1234ABC',
    });

    expect(text).toBe(
      `Voy en un viaje compartido de la UAL: Roquetas de Mar → Campus · Parking 1, salida a las ${TIME}. ` +
        'Conduce Lucía (Seat Ibiza, matrícula 1234ABC).',
    );
  });

  it('leaves out the car when it is unknown', () => {
    const text = buildLiveShareText(ROUTE, { name: 'Lucía', vehicleName: null, plate: null });

    expect(text.endsWith('Conduce Lucía.')).toBe(true);
  });
});
