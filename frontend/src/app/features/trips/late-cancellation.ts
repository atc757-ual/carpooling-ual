// Cuándo una cancelación con la plaza aceptada es tardía (como el backend,
// trip-timing.ts; decidido con el autor el 15/11/2026): el conductor, a menos
// de 20 min de la salida; el pasajero, a menos de 10, cuando ya nadie puede
// pedir su plaza
export const DRIVER_LATE_CANCELLATION_LEAD_MIN = 20;
export const PASSENGER_LATE_CANCELLATION_LEAD_MIN = 10;

const MINUTE_MS = 60 * 1000;

// Si faltan menos de esos minutos para la salida
export function isWithinLeadMinutes(departureAt: string, leadMin: number, now: number): boolean {
  return new Date(departureAt).getTime() - now < leadMin * MINUTE_MS;
}

// Hasta qué momento se cancela sin coste (ISO)
export function freeCancellationUntil(departureAt: string, leadMin: number): string {
  return new Date(new Date(departureAt).getTime() - leadMin * MINUTE_MS).toISOString();
}
