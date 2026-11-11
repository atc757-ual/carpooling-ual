// Nombre del campus en el trayecto («Campus UAL» y, debajo, el parking)
export const CAMPUS_NAME = 'Campus UAL';

// Si un nombre de origen o destino es del campus («Campus UAL · Parking P1»)
export function isCampusName(name: string | null | undefined): boolean {
  return Boolean(name?.startsWith(CAMPUS_NAME));
}
