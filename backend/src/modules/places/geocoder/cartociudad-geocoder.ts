import { Injectable } from '@nestjs/common';
import { GeocoderUnavailableError } from '../errors/geocoder-unavailable.error';
import { formatAddress, formatLocality } from './address-format';
import type {
  GeocodedPlace,
  GeocodedSuggestion,
  GeoPoint,
  Geocoder,
} from './geocoder';

// Geocodificador de CartoCiudad (IGN): direcciones oficiales de España con el
// número de portal, gratuito y sin clave. Sus datos exigen citar la fuente:
// «CartoCiudad cedido por © Instituto Geográfico Nacional» (en la app)
const BASE_URL = 'https://www.cartociudad.es/geocoder/api/geocoder';
const TIMEOUT_MS = 5000;
// Solo direcciones de la provincia (la zona de servicio cabe en ella); fuera
// quedan municipios, topónimos, estancos y lugares sin dirección
const PROVINCE = 'Almería';
const EXCLUDED_TYPES = 'municipio,poblacion,toponimo,expendeduria,ngbe';

// Lo que usamos de cada dirección de CartoCiudad
interface CartoCiudadAddress {
  id: string;
  type: string;
  address: string;
  tip_via: string | null;
  portalNumber: number | null;
  muni: string;
  poblacion: string;
  lat: number;
  lng: number;
}

// La vía sin el tipo, el número ni la localidad: las sugerencias lo traen
// en un solo texto («AVENIDA MEDITERRANEO (DEL) 120, Almería»), al buscarla no
function getStreetName(result: CartoCiudadAddress): string {
  let name = result.address.split(',')[0].trim();
  if (result.tip_via && name.startsWith(`${result.tip_via} `)) {
    name = name.slice(result.tip_via.length + 1);
  }
  if (result.portalNumber && name.endsWith(` ${result.portalNumber}`)) {
    name = name.slice(0, -` ${result.portalNumber}`.length);
  }
  return name;
}

function toSuggestion(result: CartoCiudadAddress): GeocodedSuggestion {
  return {
    ref: [result.type, result.id, result.portalNumber ?? ''].join('|'),
    name: formatAddress({
      streetType: result.tip_via,
      streetName: getStreetName(result),
      portalNumber: result.portalNumber,
    }),
    locality: formatLocality(result.poblacion, result.muni),
  };
}

function toPlace(result: CartoCiudadAddress): GeocodedPlace {
  return {
    ...toSuggestion(result),
    municipality: result.muni,
    location: { lon: result.lng, lat: result.lat },
  };
}

function isAddress(value: unknown): value is CartoCiudadAddress {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CartoCiudadAddress).id === 'string' &&
    typeof (value as CartoCiudadAddress).lat === 'number'
  );
}

@Injectable()
export class CartoCiudadGeocoder implements Geocoder {
  async suggest(text: string, limit: number): Promise<GeocodedSuggestion[]> {
    const results = await this.get('candidates', {
      q: text,
      limit: String(limit),
      provincia_filter: PROVINCE,
      no_process: EXCLUDED_TYPES,
    });
    return Array.isArray(results)
      ? results.filter(isAddress).map(toSuggestion)
      : [];
  }

  async find(ref: string): Promise<GeocodedPlace | null> {
    const [type, id, portal] = ref.split('|');
    if (!type || !id) {
      return null;
    }
    const result = await this.get('find', {
      id,
      type,
      ...(portal ? { portal } : {}),
    });
    return isAddress(result) && result.lat !== 0 ? toPlace(result) : null;
  }

  async reverse({ lon, lat }: GeoPoint): Promise<GeocodedPlace | null> {
    const result = await this.get('reverseGeocode', {
      lon: String(lon),
      lat: String(lat),
    });
    return isAddress(result) ? toPlace(result) : null;
  }

  // Sin respuesta a tiempo o con error: el servicio no está disponible. Una
  // respuesta vacía es «nada encontrado» (null)
  private async get(
    path: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = `${BASE_URL}/${path}?${new URLSearchParams(params).toString()}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new GeocoderUnavailableError();
    }
    if (!response.ok) {
      throw new GeocoderUnavailableError();
    }
    const body = await response.text();
    if (!body.trim()) {
      return null;
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new GeocoderUnavailableError();
    }
  }
}
