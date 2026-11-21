import { straightLineKm } from '../../../shared/geo/straight-line-km';
import { readNumber, readPoint, readString, TwinPoint } from './twin-event';

// Lo más que guarda el recorrido: unas 2 h con una posición cada 10 s. Con
// más, se quedan las últimas (los km siguen sumando todo el viaje)
export const MAX_TRACK_POINTS = 720;

// Una parada fija del viaje (modo «paradas»), en su orden
export interface RouteStopTwin {
  id: string;
  order: number;
  name: string | null;
  point: TwinPoint | null;
  etaOffsetMin: number | null;
}

// La ruta del viaje como parte de su gemelo (RF-13, DP-10): la prevista
// (origen, paradas y destino, de los eventos del viaje) y la real (las
// posiciones del conductor mientras está en curso, con los km recorridos).
// Clase pura: solo aplica lo que llega en los eventos
export class TripRoute {
  origin: TwinPoint | null = null;
  destination: TwinPoint | null = null;
  stops: RouteStopTwin[] = [];
  track: TwinPoint[] = [];
  // Posiciones recibidas en todo el viaje (aunque el recorrido guarde menos)
  trackPoints = 0;
  private travelledKmTotal = 0;

  // Km recorridos según las posiciones (en línea recta entre cada dos), con
  // dos decimales
  get travelledKm(): number {
    return Math.round(this.travelledKmTotal * 100) / 100;
  }

  // La ruta prevista que trae cada evento del viaje (su estado completo)
  applyPlan(payload: Record<string, unknown>): void {
    this.origin = readPoint(payload, 'origin');
    this.destination = readPoint(payload, 'destination');
    this.stops = readStops(payload);
  }

  // Una posición del conductor: se añade si no repite la anterior
  addPosition(point: TwinPoint | null): void {
    if (point === null) {
      return;
    }
    const last = this.track.at(-1);
    if (last && isSamePoint(last, point)) {
      return;
    }
    if (last) {
      this.travelledKmTotal += straightLineKm(
        last.coordinates,
        point.coordinates,
      );
    }
    this.track.push(point);
    this.trackPoints += 1;
    if (this.track.length > MAX_TRACK_POINTS) {
      this.track.shift();
    }
  }

  // Minimización al cerrarse el viaje: olvida de dónde salió el conductor y
  // por dónde pasó; se quedan el destino, las paradas (lugares públicos) y
  // el resumen del recorrido
  forget(): void {
    this.origin = null;
    this.track = [];
  }
}

function isSamePoint(a: TwinPoint, b: TwinPoint): boolean {
  return (
    a.coordinates[0] === b.coordinates[0] &&
    a.coordinates[1] === b.coordinates[1]
  );
}

// Las paradas del payload, en su orden; las que no se entienden se ignoran
function readStops(payload: Record<string, unknown>): RouteStopTwin[] {
  const raw = payload['stops'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      id: readString(item, 'id') ?? '',
      order: readNumber(item, 'position') ?? 0,
      name: readString(item, 'name'),
      point: readPoint(item, 'location'),
      etaOffsetMin: readNumber(item, 'etaOffsetMin'),
    }))
    .filter((stop) => stop.id !== '')
    .sort((a, b) => a.order - b.order);
}
