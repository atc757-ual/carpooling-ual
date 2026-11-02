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

// Antelación mínima para responder solicitudes antes de la salida (30 min);
// si el conductor no responde antes, la solicitud caduca automáticamente
export const REQUEST_RESPONSE_LEAD_MIN = 30;

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
