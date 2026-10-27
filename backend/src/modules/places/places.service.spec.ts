import { jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import type { EventsService } from '../../events/events.service';
import { PlaceNotFoundError } from './errors/place-not-found.error';
import type { GeocodedPlace, Geocoder } from './geocoder/geocoder';
import { PlacesService } from './places.service';

const REF = 'portal|01.04.MUN_040130234515|120';
const ID = Buffer.from(REF).toString('base64url');
const PLACE: GeocodedPlace = {
  ref: REF,
  name: 'Avenida del Mediterraneo, 120',
  locality: 'Almería',
  municipality: 'Almería',
  location: { lon: -2.44615, lat: 36.83256 },
};

describe('PlacesService', () => {
  const geocoder = {
    suggest: jest.fn<Geocoder['suggest']>(),
    find: jest.fn<Geocoder['find']>(),
    reverse: jest.fn<Geocoder['reverse']>(),
  };
  const query = jest.fn<(sql: string, params: unknown[]) => Promise<unknown>>();
  const manager = {};
  const record = jest.fn<EventsService['record']>();
  const service = new PlacesService(
    geocoder,
    { query, manager } as unknown as DataSource,
    { record },
  );

  beforeEach(() => jest.clearAllMocks());

  it('gives each suggestion an opaque id that leads back to it', async () => {
    geocoder.suggest.mockResolvedValue([
      { ref: REF, name: PLACE.name, locality: 'Almería' },
    ]);

    const [suggestion] = await service.suggest('mediterraneo', 5);

    expect(suggestion).toEqual({
      id: ID,
      name: PLACE.name,
      locality: 'Almería',
    });
    geocoder.find.mockResolvedValue(PLACE);
    query.mockResolvedValue([{ covered: true }]);
    await service.getPlace(suggestion.id);
    expect(geocoder.find).toHaveBeenCalledWith(REF);
  });

  it('gets a covered place without reporting anything', async () => {
    geocoder.find.mockResolvedValue(PLACE);
    query.mockResolvedValue([{ covered: true }]);

    const place = await service.getPlace(ID);

    expect(place).toEqual({
      id: ID,
      name: PLACE.name,
      locality: 'Almería',
      municipality: 'Almería',
      location: PLACE.location,
      isCovered: true,
    });
    expect(query.mock.calls[0][1]).toEqual([-2.44615, 36.83256]);
    expect(record).not.toHaveBeenCalled();
  });

  it('reports a place out of the area anonymously: municipality and ~1 km cell', async () => {
    geocoder.reverse.mockResolvedValue({
      ...PLACE,
      municipality: 'Vera',
      location: { lon: -1.86584, lat: 37.24337 },
    });
    query.mockResolvedValue([{ covered: false }]);

    const place = await service.reverse({ lon: -1.8658, lat: 37.2434 });

    expect(place.isCovered).toBe(false);
    expect(record).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: 'coverage.gap_reported',
        payload: {
          municipality: 'Vera',
          approximateLocation: { type: 'Point', coordinates: [-1.87, 37.24] },
        },
      }),
    );
  });

  it('fails when there is no address there', async () => {
    geocoder.find.mockResolvedValue(null);

    await expect(service.getPlace(ID)).rejects.toBeInstanceOf(
      PlaceNotFoundError,
    );
  });
});
