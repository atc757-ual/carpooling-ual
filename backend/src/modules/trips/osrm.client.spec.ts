import { ConfigService } from '@nestjs/config';
import type { Point } from 'typeorm';
import { OsrmClient, OsrmUnavailableError } from './osrm.client';

// Cliente de OSRM con fetch simulado: lo que pide y cómo interpreta cada
// respuesta (sin OSRM de verdad, que no está en el CI)
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const GEOMETRY = {
  type: 'LineString',
  coordinates: [
    [-2.4598, 36.838],
    [-2.4048, 36.8295],
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OsrmClient', () => {
  const config = {
    getOrThrow: () => 'http://osrm:5000',
  } as unknown as ConfigService;
  const client = new OsrmClient(config);
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks for the driving route with its full GeoJSON geometry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        code: 'Ok',
        routes: [{ distance: 7760, duration: 668.4, geometry: GEOMETRY }],
      }),
    );

    const route = await client.route(ALMERIA_CENTRE, UAL_CAMPUS);

    expect(route).toEqual({
      distanceKm: 7.76,
      durationMin: 11,
      geometry: GEOMETRY,
      source: 'osrm',
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).href).toBe(
      'http://osrm:5000/route/v1/driving/-2.459700,36.838100;-2.404800,36.829500?overview=full&geometries=geojson',
    );
  });

  it('only puts numbers in the URL: anything else never reaches OSRM', async () => {
    const forged = {
      type: 'Point',
      coordinates: ['1/../../admin?', 36.8],
    } as unknown as Point;

    await expect(client.route(forged, UAL_CAMPUS)).rejects.toThrow(
      'OSRM unavailable: invalid coordinate 1/../../admin?',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails when OSRM finds no route (400 with its own code)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { code: 'NoRoute' }));

    await expect(client.route(ALMERIA_CENTRE, UAL_CAMPUS)).rejects.toThrow(
      new OsrmUnavailableError('no route (NoRoute)'),
    );
  });

  it('fails on a server error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));

    await expect(client.route(ALMERIA_CENTRE, UAL_CAMPUS)).rejects.toThrow(
      'OSRM unavailable: HTTP 503',
    );
  });

  it('fails when OSRM is not reachable or times out', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.route(ALMERIA_CENTRE, UAL_CAMPUS)).rejects.toThrow(
      'OSRM unavailable: fetch failed',
    );
  });
});
