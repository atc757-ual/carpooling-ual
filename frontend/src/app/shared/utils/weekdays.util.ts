// Días de la semana y fechas del calendario («AAAA-MM-DD», sin horas ni zona):
// lo que comparten «Repetir otros días» al publicar y «Mi trayecto» al buscar

// Lunes (1) a domingo (7), en ese orden
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// 1 (lunes) a 7 (domingo)
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}
