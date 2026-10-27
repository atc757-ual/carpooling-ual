import { jest } from '@jest/globals';
import { GeocoderUnavailableError } from '../errors/geocoder-unavailable.error';
import { CartoCiudadGeocoder } from './cartociudad-geocoder';

// Respuestas reales de CartoCiudad (recortadas a lo que se usa)
const PORTAL_SUGGESTION = {
  id: '01.04.MUN_040130234515',
  type: 'portal',
  address: 'AVENIDA MEDITERRANEO (DEL) 120, Almería',
  tip_via: 'AVENIDA',
  portalNumber: 120,
  muni: 'Almería',
  poblacion: 'Almería',
  lat: 36.83256,
  lng: -2.44615,
};
const STREET_SUGGESTION = {
  id: '40130001508',
  type: 'callejero',
  address: 'CALLE SACRAMENTO, La Cañada de San Urbano (Almería)',
  tip_via: 'CALLE',
  portalNumber: null,
  muni: 'Almería',
  poblacion: 'La Cañada de San Urbano',
  lat: 0,
  lng: 0,
};
const REVERSE = {
  id: '01.04.MUN_040130221054',
  type: 'portal',
  address: 'LACHAMBRE',
  tip_via: 'CALLE',
  portalNumber: 4,
  muni: 'Almería',
  poblacion: 'Almería',
  lat: 36.8381,
  lng: -2.46381,
};

describe('CartoCiudadGeocoder', () => {
  const geocoder = new CartoCiudadGeocoder();
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  function answer(body: unknown, status = 200): void {
    fetchMock.mockResolvedValueOnce(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
      }),
    );
  }

  function requestedUrl(): URL {
    const [input] = fetchMock.mock.calls[0];
    return new URL(input instanceof Request ? input.url : input);
  }

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  it('suggests addresses of the province, written as they read', async () => {
    answer([PORTAL_SUGGESTION, STREET_SUGGESTION]);

    const suggestions = await geocoder.suggest('mediterraneo 120', 5);

    expect(suggestions).toEqual([
      {
        ref: 'portal|01.04.MUN_040130234515|120',
        name: 'Avenida del Mediterraneo, 120',
        locality: 'Almería',
      },
      {
        ref: 'callejero|40130001508|',
        name: 'Calle Sacramento',
        locality: 'La Cañada de San Urbano (Almería)',
      },
    ]);
    const url = requestedUrl();
    expect(url.pathname).toMatch(/\/candidates$/);
    expect(url.searchParams.get('provincia_filter')).toBe('Almería');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  it('finds a suggestion with its point', async () => {
    answer({ ...PORTAL_SUGGESTION, address: 'MEDITERRANEO (DEL)' });

    const place = await geocoder.find('portal|01.04.MUN_040130234515|120');

    expect(place).toEqual({
      ref: 'portal|01.04.MUN_040130234515|120',
      name: 'Avenida del Mediterraneo, 120',
      locality: 'Almería',
      municipality: 'Almería',
      location: { lon: -2.44615, lat: 36.83256 },
    });
    expect(requestedUrl().searchParams.get('portal')).toBe('120');
  });

  it('finds nothing for a wrong reference or an answer without a point', async () => {
    await expect(geocoder.find('nonsense')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    answer(STREET_SUGGESTION);
    await expect(geocoder.find('callejero|40130001508|')).resolves.toBeNull();
  });

  it('gets the nearest address of a point, or nothing', async () => {
    answer(REVERSE);
    await expect(
      geocoder.reverse({ lon: -2.4637, lat: 36.8381 }),
    ).resolves.toMatchObject({ name: 'Calle Lachambre, 4' });

    answer('');
    await expect(geocoder.reverse({ lon: 0, lat: 0 })).resolves.toBeNull();
  });

  it('is unavailable when CartoCiudad fails, errs or answers nonsense', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(geocoder.suggest('calle', 5)).rejects.toBeInstanceOf(
      GeocoderUnavailableError,
    );

    answer('error', 500);
    await expect(geocoder.suggest('calle', 5)).rejects.toBeInstanceOf(
      GeocoderUnavailableError,
    );

    answer('<html>');
    await expect(geocoder.suggest('calle', 5)).rejects.toBeInstanceOf(
      GeocoderUnavailableError,
    );
  });
});
