// Fecha local en formato ISO (2026-10-27), el que espera ion-datetime. Local y
// no UTC: a la una de la madrugada en España, toISOString() todavía daría el
// día anterior
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
