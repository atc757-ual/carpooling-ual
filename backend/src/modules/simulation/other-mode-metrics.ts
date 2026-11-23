import type { MetricStat, ReplicaMetrics } from './simulation-metrics';

// Accesibilidad: quienes iban en transporte público o de otra forma y se
// apuntan al carpooling (supuestos nonCarAdoptionRate y nonCarDriverShare del
// escenario). No cuentan para los vehículos evitados (no dejan ningún coche);
// lo que se mide es cuántos consiguen plaza y que no salgan coches de más

// Lo de una réplica, en tramos (cada persona, a la ida y a la vuelta)
export interface OtherModeMetrics {
  // Tramos en que piden plaza y en los que la consiguen
  passengerTrips: number;
  coveredTrips: number;
  coveredPct: number;
  // Coches que salen de más: los de quien iba en otro modo y conduce porque
  // ha conseguido pasajeros
  addedVehicles: number;
}

export interface OtherModeStats {
  coveredTrips: MetricStat;
  coveredPct: MetricStat;
  addedVehicles: MetricStat;
}

// La media de cada métrica entre réplicas, o null si alguna réplica es de
// antes de medirlo
export function describeOtherMode(
  replicas: ReplicaMetrics[],
  describe: (values: number[]) => MetricStat,
): OtherModeStats | null {
  const values = replicas.map((replica) => replica.otherMode);
  if (values.length === 0 || values.includes(null)) {
    return null;
  }
  const known = values.filter((value) => value !== null);
  return {
    coveredTrips: describe(known.map((value) => value.coveredTrips)),
    coveredPct: describe(known.map((value) => value.coveredPct)),
    addedVehicles: describe(known.map((value) => value.addedVehicles)),
  };
}

// Sus columnas al final de cada fila del CSV
export const OTHER_MODE_COLUMNS: readonly (keyof OtherModeMetrics)[] = [
  'passengerTrips',
  'coveredTrips',
  'coveredPct',
  'addedVehicles',
];
