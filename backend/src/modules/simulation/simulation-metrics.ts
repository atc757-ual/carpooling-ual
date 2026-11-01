// Métricas de la simulación (RF-18) y su agregación entre réplicas. Funciones
// puras: las usa el servicio con lo que devuelva cualquier SimulationRunner

// Criterio de éxito experimental (sección 11 de la memoria)
export const MIN_VEHICLES_AVOIDED_PCT = 15;
export const MIN_REQUESTS_COVERED_PCT = 70;

// Métricas de una réplica: el escenario y la base con la misma semilla
export interface ReplicaMetrics {
  replica: number;
  seed: number;
  vehiclesUsed: number;
  baselineVehiclesUsed: number;
  vehiclesAvoidedPct: number;
  requestsCoveredPct: number;
  averageOccupancy: number;
  baselineAverageOccupancy: number;
  matchingP95Ms: number;
  // Solo en escenarios con incidencias (S5): pasajeros afectados que encuentran
  // otro viaje, en %
  recoveryPct: number | null;
  vehiclesBySlot: number[];
  baselineVehiclesBySlot: number[];
}

export interface SimulationOutput {
  // Inicio de cada franja horaria (HH:mm)
  slots: string[];
  replicas: ReplicaMetrics[];
}

// Media, desviación típica e intervalo de confianza del 95 %
export interface MetricStat {
  mean: number;
  sd: number;
  ciLow: number;
  ciHigh: number;
}

export interface ComparedStat {
  scenario: MetricStat;
  baseline: MetricStat;
}

export interface SimulationSummary {
  vehiclesUsed: ComparedStat;
  averageOccupancy: ComparedStat;
  vehiclesAvoidedPct: MetricStat;
  requestsCoveredPct: MetricStat;
  matchingP95Ms: MetricStat;
  recoveryPct: MetricStat | null;
}

export interface SlotSeries {
  slot: string;
  vehicles: number;
  baselineVehicles: number;
}

export interface AggregatedResults {
  summary: SimulationSummary;
  series: SlotSeries[];
  criterionMet: boolean;
}

// Valor crítico de la t de Student (dos colas, 95 %) para 1-30 grados de
// libertad; a partir de ahí se usa la normal
const T_CRITICAL_95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201,
  2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074,
  2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
const Z_CRITICAL_95 = 1.96;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function describeValues(values: number[]): MetricStat {
  const average = mean(values);
  const n = values.length;
  if (n < 2) {
    return {
      mean: round(average),
      sd: 0,
      ciLow: round(average),
      ciHigh: round(average),
    };
  }
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const critical = T_CRITICAL_95[n - 2] ?? Z_CRITICAL_95;
  const margin = (critical * sd) / Math.sqrt(n);
  return {
    mean: round(average),
    sd: round(sd),
    ciLow: round(average - margin),
    ciHigh: round(average + margin),
  };
}

function describeEach(
  replicas: ReplicaMetrics[],
  pick: (replica: ReplicaMetrics) => number,
): MetricStat {
  return describeValues(replicas.map(pick));
}

function describeRecovery(replicas: ReplicaMetrics[]): MetricStat | null {
  const values = replicas
    .map((replica) => replica.recoveryPct)
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : describeValues(values);
}

function slotSeries(output: SimulationOutput): SlotSeries[] {
  return output.slots.map((slot, index) => ({
    slot,
    vehicles: round(mean(output.replicas.map((r) => r.vehiclesBySlot[index]))),
    baselineVehicles: round(
      mean(output.replicas.map((r) => r.baselineVehiclesBySlot[index])),
    ),
  }));
}

// El criterio lo decide el backend, no el frontend: reducción de vehículos
// >= 15 % frente a la base Y solicitudes cubiertas >= 70 % (medias)
export function isCriterionMet(summary: SimulationSummary): boolean {
  return (
    summary.vehiclesAvoidedPct.mean >= MIN_VEHICLES_AVOIDED_PCT &&
    summary.requestsCoveredPct.mean >= MIN_REQUESTS_COVERED_PCT
  );
}

export function aggregate(output: SimulationOutput): AggregatedResults {
  const { replicas } = output;
  const summary: SimulationSummary = {
    vehiclesUsed: {
      scenario: describeEach(replicas, (r) => r.vehiclesUsed),
      baseline: describeEach(replicas, (r) => r.baselineVehiclesUsed),
    },
    averageOccupancy: {
      scenario: describeEach(replicas, (r) => r.averageOccupancy),
      baseline: describeEach(replicas, (r) => r.baselineAverageOccupancy),
    },
    vehiclesAvoidedPct: describeEach(replicas, (r) => r.vehiclesAvoidedPct),
    requestsCoveredPct: describeEach(replicas, (r) => r.requestsCoveredPct),
    matchingP95Ms: describeEach(replicas, (r) => r.matchingP95Ms),
    recoveryPct: describeRecovery(replicas),
  };
  return {
    summary,
    series: slotSeries(output),
    criterionMet: isCriterionMet(summary),
  };
}

const CSV_COLUMNS: readonly (keyof ReplicaMetrics)[] = [
  'replica',
  'seed',
  'vehiclesUsed',
  'baselineVehiclesUsed',
  'vehiclesAvoidedPct',
  'requestsCoveredPct',
  'averageOccupancy',
  'baselineAverageOccupancy',
  'matchingP95Ms',
  'recoveryPct',
];

// Métricas por réplica en CSV (RF-20), una fila por réplica
export function toCsv(replicas: ReplicaMetrics[]): string {
  const rows = replicas.map((replica) =>
    CSV_COLUMNS.map((column) => String(replica[column] ?? '')).join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}
