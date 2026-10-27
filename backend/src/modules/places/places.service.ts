import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { PlaceNotFoundError } from './errors/place-not-found.error';
import type {
  GeocodedPlace,
  GeocodedSuggestion,
  GeoPoint,
  Geocoder,
} from './geocoder/geocoder';
import { GEOCODER } from './geocoder/geocoder';

// Grados a los que se redondea la ubicación de un evento de cobertura: 0,01°
// son ~1 km, suficiente para saber de qué zona piden y sin señalar una casa
const COVERAGE_CELL_DEGREES = 0.01;

// Una sugerencia o una dirección con nuestro id (la referencia del proveedor
// en base64url: opaca y segura en una URL)
export type PlaceSuggestion = Omit<GeocodedSuggestion, 'ref'> & { id: string };
export type Place = Omit<GeocodedPlace, 'ref'> & {
  id: string;
  // Dentro de la zona de servicio (30 km alrededor del campus)
  isCovered: boolean;
};

function toId(ref: string): string {
  return Buffer.from(ref, 'utf8').toString('base64url');
}

function toRef(id: string): string {
  return Buffer.from(id, 'base64url').toString('utf8');
}

// -2.4637 → -2.46 (toFixed quita los decimales sueltos de la multiplicación)
function roundToCell(value: number): number {
  const rounded =
    Math.round(value / COVERAGE_CELL_DEGREES) * COVERAGE_CELL_DEGREES;
  return Number(rounded.toFixed(2));
}

// Búsqueda de direcciones (RF por definir: ver pendientes de la memoria) con
// el geocodificador, y si están dentro de la zona de servicio. Una dirección
// fuera de la zona registra el evento coverage.gap_reported: dónde piden
// cobertura, de forma anónima
@Injectable()
export class PlacesService {
  constructor(
    @Inject(GEOCODER) private readonly geocoder: Geocoder,
    private readonly dataSource: DataSource,
    private readonly eventsService: EventsService,
  ) {}

  async suggest(text: string, limit: number): Promise<PlaceSuggestion[]> {
    const suggestions = await this.geocoder.suggest(text, limit);
    return suggestions.map(({ ref, ...suggestion }) => ({
      ...suggestion,
      id: toId(ref),
    }));
  }

  async getPlace(id: string): Promise<Place> {
    return this.withCoverage(await this.geocoder.find(toRef(id)));
  }

  async reverse(point: GeoPoint): Promise<Place> {
    return this.withCoverage(await this.geocoder.reverse(point));
  }

  private async withCoverage(found: GeocodedPlace | null): Promise<Place> {
    if (!found) {
      throw new PlaceNotFoundError();
    }
    const { ref, ...place } = found;
    const isCovered = await this.isCovered(place.location);
    if (!isCovered) {
      await this.reportCoverageGap(place);
    }
    return { ...place, id: toId(ref), isCovered };
  }

  private async isCovered({ lon, lat }: GeoPoint): Promise<boolean> {
    const [row] = await this.dataSource.query<{ covered: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM service_areas
         WHERE is_active
           AND ST_Covers(area, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
       ) AS covered`,
      [lon, lat],
    );
    return row.covered;
  }

  // Minimización (RGPD): solo el municipio y la celda de ~1 km, sin el
  // usuario ni la dirección. No cambia ninguna entidad, así que el evento es
  // su propia fuente (un id nuevo)
  private async reportCoverageGap({
    municipality,
    location,
  }: Omit<GeocodedPlace, 'ref'>): Promise<void> {
    await this.eventsService.record(this.dataSource.manager, {
      type: 'coverage.gap_reported',
      sourceEntityId: randomUUID(),
      payload: {
        municipality,
        approximateLocation: {
          type: 'Point',
          coordinates: [roundToCell(location.lon), roundToCell(location.lat)],
        },
      },
    });
  }
}
