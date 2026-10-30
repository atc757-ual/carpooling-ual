import { DataSource } from 'typeorm';

const MINUTE_MS = 60 * 1000;

// Salida válida para publicar (la API exige al menos una hora de antelación)
export function publishableDeparture(): Date {
  return new Date(Date.now() + 2 * 60 * MINUTE_MS);
}

// Deja la salida de un viaje ya publicado a estos minutos de ahora (pueden ser
// negativos), directamente en la base de datos: así se prueba lo que pasa
// cerca de la salida (iniciar, cancelar tarde…) sin saltarse la antelación
// mínima al publicar. Devuelve la nueva hora de salida
export async function setDepartureIn(
  dataSource: DataSource,
  tripId: string,
  minutes: number,
): Promise<Date> {
  const departureAt = new Date(Date.now() + minutes * MINUTE_MS);
  await dataSource.query(`UPDATE trips SET departure_at = $1 WHERE id = $2`, [
    departureAt,
    tripId,
  ]);
  return departureAt;
}
