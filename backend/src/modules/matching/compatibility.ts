// Puntuación de compatibilidad (pieza pura del matching): no toca la base de
// datos ni la red, así la usan igual la plataforma y el simulador y se prueba
// sola. Recibe los candidatos con su desvío ya calculado, descarta los que no
// encajan y ordena el resto de más a menos compatible.

// Peso de cada criterio en la puntuación (suman 1): el desvío pesa más porque
// es lo que el conductor tiene que aceptar
export const DETOUR_WEIGHT = 0.6;
export const TIME_WEIGHT = 0.4;

const MS_PER_MINUTE = 60_000;

// Al ir al campus importa a qué hora se llega; al volver, a qué hora se sale
export type TimeReference = 'arrival' | 'departure';

export interface MatchCriteria {
  // Hora que quiere el pasajero (de llegada o de salida, según timeReference)
  desiredAt: Date;
  timeReference: TimeReference;
  // Minutos que acepta de diferencia, antes o después
  marginMin: number;
  seats: number;
}

export interface MatchCandidate {
  tripId: string;
  departureAt: Date;
  // Duración de la ruta original del conductor
  durationMin: number;
  // Minutos que añade recoger o dejar al pasajero
  detourMin: number;
  maxDetourMin: number;
  availableSeats: number;
}

export interface ScoredMatch<T extends MatchCandidate = MatchCandidate> {
  candidate: T;
  // Hora comparable con la deseada (llegada con el desvío incluido, o salida)
  referenceAt: Date;
  // Diferencia con la hora deseada, en minutos (negativa si es antes)
  timeDifferenceMin: number;
  // De 0 (justo en los límites) a 1 (sin desvío y a la hora exacta)
  score: number;
}

export function getReferenceAt(
  candidate: MatchCandidate,
  timeReference: TimeReference,
): Date {
  if (timeReference === 'departure') {
    return candidate.departureAt;
  }
  const travelMin = candidate.durationMin + candidate.detourMin;
  return new Date(candidate.departureAt.getTime() + travelMin * MS_PER_MINUTE);
}

// Puntúa un candidato o devuelve null si no encaja: sin plazas suficientes,
// con más desvío del que acepta el conductor o fuera del margen horario
export function scoreCandidate<T extends MatchCandidate>(
  candidate: T,
  criteria: MatchCriteria,
): ScoredMatch<T> | null {
  if (candidate.availableSeats < criteria.seats) {
    return null;
  }
  if (candidate.detourMin > candidate.maxDetourMin) {
    return null;
  }
  const referenceAt = getReferenceAt(candidate, criteria.timeReference);
  const timeDifferenceMin = Math.round(
    (referenceAt.getTime() - criteria.desiredAt.getTime()) / MS_PER_MINUTE,
  );
  if (Math.abs(timeDifferenceMin) > criteria.marginMin) {
    return null;
  }
  // Cada criterio, de 0 (en el límite) a 1 (perfecto); con límite 0 (sin
  // desvío o sin margen permitidos), solo se llega aquí con el valor perfecto
  const detourFit = ratioFit(candidate.detourMin, candidate.maxDetourMin);
  const timeFit = ratioFit(Math.abs(timeDifferenceMin), criteria.marginMin);
  const score = DETOUR_WEIGHT * detourFit + TIME_WEIGHT * timeFit;
  return {
    candidate,
    referenceAt,
    timeDifferenceMin,
    score: Math.round(score * 100) / 100,
  };
}

// Los que encajan, del más compatible al menos; a igual puntuación, el que
// sale antes
export function scoreCandidates<T extends MatchCandidate>(
  candidates: readonly T[],
  criteria: MatchCriteria,
): ScoredMatch<T>[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, criteria))
    .filter((match): match is ScoredMatch<T> => match !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.departureAt.getTime() - b.candidate.departureAt.getTime(),
    );
}

function ratioFit(value: number, limit: number): number {
  return limit > 0 ? 1 - value / limit : 1;
}
