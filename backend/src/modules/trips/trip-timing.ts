// Tiempos de las reglas de los viajes, juntos para que encajen entre sí
export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

// RF-11: un viaje confirmado se puede iniciar desde 10 minutos antes de su
// salida: lo justo para ponerse en marcha sin llegar antes de hora a recoger
// (la hora de recogida es un compromiso con el pasajero)
export const START_WINDOW_MIN = 10;

// Cancelar con la plaza aceptada (conductor o pasajero) a menos de 30 minutos
// de la salida es tardío: la otra parte ya casi no tiene tiempo de buscar otra
// opción
export const LATE_CANCELLATION_LEAD_MIN = 30;

// Antelación mínima para publicar o mover la salida (la misma hora que propone
// Publicar por defecto): deja margen para cancelar sin penalización
export const MIN_DEPARTURE_LEAD_MIN = 60;

// Máximo de viajes no cancelados de un conductor en un mismo día (hora de
// Madrid): ida y vuelta dos veces es el uso normal; más apunta a un abuso
export const MAX_TRIPS_PER_DAY = 4;

// Corte de las solicitudes (10 min antes de la salida): desde entonces el
// viaje no sale en la búsqueda, no admite solicitudes nuevas ni respuestas, y
// las pendientes caducan. Un solo corte, para que nadie pida una plaza que el
// conductor ya no puede aceptar
export const REQUEST_CUTOFF_MIN = 10;

// Margen tras la hora pactada para cancelar automáticamente viajes que el
// conductor no inició (15 min)
export const UNSTARTED_TRIP_CANCEL_WINDOW_MIN = 15;

// Margen de cortesía en el punto de recogida antes de poder marcar «No se presentó» (5 min)
export const PICKUP_NO_SHOW_WAIT_MIN = 5;

// Cancelaciones tardías (conductor y pasajero, la misma regla): con 3 en 30
// días, 7 días sin publicar (conductor) o sin pedir plaza (pasajero)
export const LATE_CANCELLATION_WINDOW_DAYS = 30;
export const LATE_CANCELLATIONS_TO_SUSPEND = 3;
export const PUBLISHING_SUSPENSION_DAYS = 7;

// Publicar eligiendo la llegada (hacia el campus): la salida deja tiempo para
// la ruta y para el desvío máximo, así que el conductor llega a esa hora como
// muy tarde aunque recoja a alguien (sin recoger a nadie, llega antes)
export function departureForArrival(
  arrivalAt: Date,
  durationMin: number,
  maxDetourMin: number,
): Date {
  return new Date(
    arrivalAt.getTime() - (durationMin + maxDetourMin) * MINUTE_MS,
  );
}

// La salida de un viaje que se publica: la dada o, con la llegada, la que deja
// tiempo para la ruta y el desvío máximo. PublishTripDto exige una de las dos
export function resolveDeparture(
  { departureAt, arrivalAt }: { departureAt?: Date; arrivalAt?: Date },
  durationMin: number,
  maxDetourMin: number,
): Date {
  if (arrivalAt !== undefined) {
    return departureForArrival(arrivalAt, durationMin, maxDetourMin);
  }
  if (departureAt === undefined) {
    throw new Error('A trip needs departureAt or arrivalAt');
  }
  return departureAt;
}
