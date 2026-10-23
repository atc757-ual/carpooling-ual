import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LineString, Point } from 'typeorm';
import { roundTo2 } from './route-plan';
import type { RoutePlan } from './route-plan';

// Tiempo máximo de espera: OSRM en local responde en milisegundos; si tarda
// más, se usa la ruta estimada en vez de hacer esperar al conductor
const OSRM_TIMEOUT_MS = 2000;

// Lo que interesa de la respuesta de /route/v1 de OSRM
interface OsrmRouteResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: LineString }[];
}

// Una coordenada para la URL de OSRM: SOLO un número finito, escrito con 6
// decimales (~10 cm). Las coordenadas ya llegan validadas (GeoPointDto), pero
// se comprueba aquí también: en la URL de la petición nunca puede acabar otra
// cosa que un número (protección frente a falsificación de peticiones, SSRF)
function toCoordinate(value: unknown): string {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) {
    throw new OsrmUnavailableError(`invalid coordinate ${String(value)}`);
  }
  return coordinate.toFixed(6);
}

// OSRM no respondió, respondió con error o no encontró ruta
export class OsrmUnavailableError extends Error {
  constructor(reason: string) {
    super(`OSRM unavailable: ${reason}`);
    this.name = 'OsrmUnavailableError';
  }
}

// Cliente del motor de rutas OSRM (DP-02, RNF-16), por su API HTTP con el
// fetch de Node (sin dependencias). Pide la ruta en coche más rápida con su
// geometría completa en GeoJSON
@Injectable()
export class OsrmClient {
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.getOrThrow<string>('osrmUrl');
  }

  async route(origin: Point, destination: Point): Promise<RoutePlan> {
    const coordinates = [origin, destination]
      .map(
        ({ coordinates: [lon, lat] }) =>
          `${toCoordinate(lon)},${toCoordinate(lat)}`,
      )
      .join(';');
    const url = new URL(`/route/v1/driving/${coordinates}`, this.baseUrl);
    url.searchParams.set('overview', 'full');
    url.searchParams.set('geometries', 'geojson');

    const body = await this.fetchJson(url);
    const [best] = body.routes ?? [];
    if (body.code !== 'Ok' || best === undefined) {
      throw new OsrmUnavailableError(`no route (${body.code})`);
    }
    return {
      distanceKm: roundTo2(best.distance / 1000),
      durationMin: Math.max(1, Math.round(best.duration / 60)),
      geometry: best.geometry,
      source: 'osrm',
    };
  }

  private async fetchJson(url: URL): Promise<OsrmRouteResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      });
    } catch (error) {
      throw new OsrmUnavailableError(
        error instanceof Error ? error.message : String(error),
      );
    }
    // OSRM responde 400 con un código propio (p. ej. NoRoute) en el cuerpo
    if (!response.ok && response.status !== 400) {
      throw new OsrmUnavailableError(`HTTP ${response.status}`);
    }
    return (await response.json()) as OsrmRouteResponse;
  }
}
