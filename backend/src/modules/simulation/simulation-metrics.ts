// Métricas de la simulación (RF-18) y su agregación entre réplicas. Funciones
// puras: las usa el servicio con lo que devuelva cualquier SimulationRunner
import { pairedTest } from './paired-test';
import type { PairedTest } from './paired-test';

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
  // La vuelta (los vehículos de arriba son los del día: ida y vuelta); null
  // en las ejecuciones de antes de simularla
  returnVehiclesUsed: number | null;
  returnBaselineVehiclesUsed: number | null;
  requestsCoveredPct: number;
  averageOccupancy: number;
  baselineAverageOccupancy: number;
  matchingP95Ms: number;
  // Solo en escenarios con incidencias (S5): pasajeros afectados que encuentran
  // otro viaje, en %
  recoveryPct: number | null;
  // Cómo terminan los viajes de los conductores (de los dos tramos); null en
  // las ejecuciones de antes de distinguirlo
  trips: TripStates | null;
  vehiclesBySlot: number[];
  baselineVehiclesBySlot: number[];
}

// Viajes terminados (con pasajeros), caducados (sin ninguno) y cancelados
export interface TripStates {
  finished: number;
  expired: number;
  cancelled: number;
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
  // Vehículos evitados en cada tramo (null si alguna réplica es de antes de
  // simular la vuelta)
  legs: LegStats | null;
  // Viajes de cada estado por réplica (null si alguna réplica es de antes)
  tripStates: TripStateStats | null;
  // Contraste de HE1 frente a HE0 sobre los vehículos (réplicas emparejadas)
  vehiclesReduction: PairedTest;
}

export interface LegStats {
  toCampusAvoidedPct: MetricStat;
  fromCampusAvoidedPct: MetricStat;
}

export interface TripStateStats {
  finished: MetricStat;
  expired: MetricStat;
  cancelled: MetricStat;
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

function avoidedPct(base: number, scenario: number): number {
  return base > 0 ? ((base - scenario) / base) * 100 : 0;
}

// Vehículos evitados a la ida (el día menos la vuelta) y a la vuelta
function describeLegs(replicas: ReplicaMetrics[]): LegStats | null {
  const legs = replicas.map((r) =>
    r.returnVehiclesUsed === null || r.returnBaselineVehiclesUsed === null
      ? null
      : {
          toCampus: avoidedPct(
            r.baselineVehiclesUsed - r.returnBaselineVehiclesUsed,
            r.vehiclesUsed - r.returnVehiclesUsed,
          ),
          fromCampus: avoidedPct(
            r.returnBaselineVehiclesUsed,
            r.returnVehiclesUsed,
          ),
        },
  );
  if (legs.length === 0 || legs.some((leg) => leg === null)) {
    return null;
  }
  const known = legs.filter((leg) => leg !== null);
  return {
    toCampusAvoidedPct: describeValues(known.map((leg) => leg.toCampus)),
    fromCampusAvoidedPct: describeValues(known.map((leg) => leg.fromCampus)),
  };
}

function describeTripStates(replicas: ReplicaMetrics[]): TripStateStats | null {
  const states = replicas.map((r) => r.trips);
  if (states.length === 0 || states.some((trips) => trips === null)) {
    return null;
  }
  const known = states.filter((trips) => trips !== null);
  return {
    finished: describeValues(known.map((trips) => trips.finished)),
    expired: describeValues(known.map((trips) => trips.expired)),
    cancelled: describeValues(known.map((trips) => trips.cancelled)),
  };
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

// El criterio lo decide el backend, no el frontend (tabla de criterios de
// éxito de la memoria): reducción de vehículos >= 15 % frente a la base,
// solicitudes cubiertas >= 70 % (medias) Y se rechaza HE0 (relevancia práctica
// y significación estadística)
export function isCriterionMet(summary: SimulationSummary): boolean {
  return (
    summary.vehiclesAvoidedPct.mean >= MIN_VEHICLES_AVOIDED_PCT &&
    summary.requestsCoveredPct.mean >= MIN_REQUESTS_COVERED_PCT &&
    summary.vehiclesReduction.rejectsNull
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
    legs: describeLegs(replicas),
    tripStates: describeTripStates(replicas),
    vehiclesReduction: pairedTest(
      replicas.map((r) => r.baselineVehiclesUsed - r.vehiclesUsed),
    ),
  };
  return {
    summary,
    series: slotSeries(output),
    criterionMet: isCriterionMet(summary),
  };
}

// Las cifras sueltas de una réplica (sin las franjas ni los estados)
type ScalarMetric = Exclude<
  keyof ReplicaMetrics,
  'trips' | 'vehiclesBySlot' | 'baselineVehiclesBySlot'
>;

const CSV_COLUMNS: readonly ScalarMetric[] = [
  'replica',
  'seed',
  'vehiclesUsed',
  'baselineVehiclesUsed',
  'vehiclesAvoidedPct',
  'returnVehiclesUsed',
  'returnBaselineVehiclesUsed',
  'requestsCoveredPct',
  'averageOccupancy',
  'baselineAverageOccupancy',
  'matchingP95Ms',
  'recoveryPct',
];

// Los viajes de cada estado, al final de cada fila
const TRIP_COLUMNS: readonly (keyof TripStates)[] = [
  'finished',
  'expired',
  'cancelled',
];

// Métricas por réplica en CSV (RF-20), una fila por réplica
export function toCsv(replicas: ReplicaMetrics[]): string {
  const header = [
    ...CSV_COLUMNS,
    ...TRIP_COLUMNS.map((state) => `trips_${state}`),
  ];
  const rows = replicas.map((replica) =>
    [
      ...CSV_COLUMNS.map((column) => String(replica[column] ?? '')),
      ...TRIP_COLUMNS.map((state) => String(replica.trips?.[state] ?? '')),
    ].join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}
