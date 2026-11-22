import { Injectable } from '@nestjs/common';
import type { SeatRequest } from '../requests/entities/seat-request.entity';
import { NotRequestPassengerError } from '../requests/errors/not-request-passenger.error';
import { TRIP_CANCELLED_REASON } from '../requests/request-status';
import { RequestsService } from '../requests/requests.service';
import { TripsService } from '../trips/trips.service';
import { RequestNotRelocatableError } from './errors/request-not-relocatable.error';
import {
  MatchingService,
  type MatchCriteria,
  type TripMatch,
} from './matching.service';

const MINUTE_MS = 60_000;
const TIME_ZONE = 'Europe/Madrid';
// «Al 100 %» (decidido con el autor el 15/11/2026): sale como mucho 15 min
// antes o después que el viaje cancelado y le recoge en su punto
export const EXACT_MARGIN_MIN = 15;
// Los que encajan con su horario: el margen más amplio de Buscar
export const OPTIONS_MARGIN_MIN = 20;
// Se le ofrece durante los 30 min siguientes a la cancelación (22/11/2026)
export const RELOCATION_WINDOW_MIN = 30;

// Por prioridad (22/11/2026): el que encaja al 100 %, los que encajan con
// su horario (±20 min) y los demás de ese día por la misma ruta. Ningún
// grupo excluye a los otros: se enseñan los tres
export interface RelocationOptions {
  exactMatch: TripMatch | null;
  matches: TripMatch[];
  sameDayMatches: TripMatch[];
}

// Una solicitud que se canceló porque el conductor canceló el viaje, en los
// 30 min siguientes
export function isRelocatable(request: SeatRequest, now: Date): boolean {
  return (
    request.status === 'cancelled' &&
    request.rejectionReason === TRIP_CANCELLED_REASON &&
    request.cancelledAt !== null &&
    now.getTime() - request.cancelledAt.getTime() <=
      RELOCATION_WINDOW_MIN * MINUTE_MS
  );
}

// Minutos que Madrid va por delante de UTC en ese instante (60 o 120)
function madridOffsetMin(date: Date): number {
  const inZone = (timeZone: string) =>
    Date.parse(date.toLocaleString('en-US', { timeZone }));
  return (inZone(TIME_ZONE) - inZone('UTC')) / MINUTE_MS;
}

// El día de esa fecha en Madrid, de las 00:00 a las 24:00
export function madridDay(date: Date): { start: Date; end: Date } {
  const isoDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
  }).format(date);
  const midnight = (utcMidnight: Date) =>
    new Date(utcMidnight.getTime() - madridOffsetMin(utcMidnight) * MINUTE_MS);
  const utcStart = new Date(`${isoDay}T00:00:00Z`);
  return {
    start: midnight(utcStart),
    end: midnight(new Date(utcStart.getTime() + 24 * 60 * MINUTE_MS)),
  };
}

// Cuando el conductor cancela, buscar al pasajero viajes como el suyo: mismo
// sentido, mismo parking y sus plazas. Solo consulta: la plaza la pide él,
// como siempre (22/11/2026: que decida el pasajero, sin asignarla)
@Injectable()
export class RelocationService {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly tripsService: TripsService,
    private readonly matchingService: MatchingService,
  ) {}

  async findOptions(
    passengerId: string,
    requestId: string,
  ): Promise<RelocationOptions> {
    const { request } = await this.requestsService.get(passengerId, requestId);
    if (request.passengerId !== passengerId) {
      throw new NotRequestPassengerError(requestId);
    }
    if (!isRelocatable(request, new Date())) {
      throw new RequestNotRelocatableError(requestId);
    }
    const { trip } = await this.tripsService.getById(request.tripId);
    const direction = request.direction ?? 'to-campus';
    const isToCampus = direction === 'to-campus';
    const route: Omit<MatchCriteria, 'desiredAt' | 'marginMin'> = {
      // Hacia el campus, su punto de recogida; al volver no se guarda dónde
      // se bajaba: el destino del viaje cancelado
      place: isToCampus
        ? (request.pickupLocation ?? trip.origin)
        : trip.destination,
      campus: isToCampus ? trip.destination : trip.origin,
      direction,
      timeReference: 'departure',
      seats: request.seats,
    };
    const { start, end } = madridDay(trip.departureAt);
    const halfDayMs = (end.getTime() - start.getTime()) / 2;
    const [onTime, sameDay] = await Promise.all([
      this.matchingService.findMatches(passengerId, {
        ...route,
        desiredAt: trip.departureAt,
        marginMin: OPTIONS_MARGIN_MIN,
      }),
      this.matchingService.findMatches(passengerId, {
        ...route,
        desiredAt: new Date(start.getTime() + halfDayMs),
        marginMin: halfDayMs / MINUTE_MS,
      }),
    ]);
    const exactMatch =
      onTime.find((match) => isExactMatch(match, trip.departureAt)) ?? null;
    const onTimeIds = new Set(onTime.map(tripIdOf));
    return {
      exactMatch,
      matches: onTime.filter((match) => match !== exactMatch),
      sameDayMatches: sameDay
        .filter((match) => !onTimeIds.has(tripIdOf(match)))
        .sort(byDeparture),
    };
  }
}

function tripIdOf({ match }: TripMatch): string {
  return match.candidate.tripId;
}

function byDeparture(first: TripMatch, second: TripMatch): number {
  return (
    first.match.candidate.departureAt.getTime() -
    second.match.candidate.departureAt.getTime()
  );
}

// Le recoge en su punto (sin paradas) y sale ±15 min del viaje cancelado
function isExactMatch({ match }: TripMatch, departureAt: Date): boolean {
  const { candidate } = match;
  return (
    candidate.stop === null &&
    Math.abs(candidate.departureAt.getTime() - departureAt.getTime()) <=
      EXACT_MARGIN_MIN * MINUTE_MS
  );
}
