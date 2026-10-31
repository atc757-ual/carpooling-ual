// Tiempos de las reglas de los viajes, juntos para que encajen entre sí
export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

// RF-11: un viaje confirmado se puede iniciar desde 30 minutos antes de su
// salida. Es también la ventana en la que cancelar con pasajeros es tardío
export const START_WINDOW_MIN = 30;

// Antelación mínima para publicar o mover la salida (la misma hora que propone
// Publicar por defecto): deja margen para cancelar sin penalización
export const MIN_DEPARTURE_LEAD_MIN = 60;

// Cancelaciones tardías (conductor y pasajero, la misma regla): con 3 en 30
// días, 7 días sin publicar (conductor) o sin pedir plaza (pasajero)
export const LATE_CANCELLATION_WINDOW_DAYS = 30;
export const LATE_CANCELLATIONS_TO_SUSPEND = 3;
export const PUBLISHING_SUSPENSION_DAYS = 7;
