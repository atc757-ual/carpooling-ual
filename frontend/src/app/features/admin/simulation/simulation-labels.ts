import {
  MetricStat,
  SimulationResults,
  SimulationRun,
  SimulationRunStatus,
} from '../../../core/models/admin-simulation.model';

// Textos de la simulación del panel. Funciones puras para probarlas sin
// pantalla

export const MIN_VEHICLES_AVOIDED_PCT = 15;
export const MIN_REQUESTS_COVERED_PCT = 70;

const STATUS_LABELS: Record<SimulationRunStatus, string> = {
  queued: 'En cola',
  running: 'En curso',
  finished: 'Terminada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

const DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export interface Kpi {
  label: string;
  value: string;
  hint: string;
  interval: string;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: digits });
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

export function runStatusLabel(status: SimulationRunStatus): string {
  return STATUS_LABELS[status];
}

export function isActive(run: Pick<SimulationRun, 'status'>): boolean {
  return run.status === 'queued' || run.status === 'running';
}

// «S1 frente a S0»
export function comparisonLabel(run: Pick<SimulationRun, 'scenario' | 'baselineScenario'>): string {
  return `${run.scenario} frente a ${run.baselineScenario}`;
}

function interval(stat: MetricStat, unit = ''): string {
  return `IC 95 %: ${formatNumber(stat.ciLow)}–${formatNumber(stat.ciHigh)}${unit}`;
}

// Las tarjetas de los resultados (RF-18): el valor medio, el objetivo o la
// referencia de la base y el intervalo de confianza
export function resultKpis(results: SimulationResults, baselineCode: string): Kpi[] {
  const { summary } = results;
  const kpis: Kpi[] = [
    {
      label: 'Vehículos evitados',
      value: `${formatNumber(summary.vehiclesAvoidedPct.mean)} %`,
      hint: `Objetivo ≥ ${MIN_VEHICLES_AVOIDED_PCT} %`,
      interval: interval(summary.vehiclesAvoidedPct, ' %'),
    },
    {
      label: 'Solicitudes cubiertas',
      value: `${formatNumber(summary.requestsCoveredPct.mean)} %`,
      hint: `Objetivo ≥ ${MIN_REQUESTS_COVERED_PCT} %`,
      interval: interval(summary.requestsCoveredPct, ' %'),
    },
    {
      label: 'Ocupación media',
      value: formatNumber(summary.averageOccupancy.scenario.mean, 2),
      hint: `personas por coche (${baselineCode}: ${formatNumber(summary.averageOccupancy.baseline.mean, 2)})`,
      interval: interval(summary.averageOccupancy.scenario),
    },
    {
      label: 'Tiempo de matching (p95)',
      value: `${formatNumber(summary.matchingP95Ms.mean, 0)} ms`,
      hint: 'Objetivo < 2 000 ms',
      interval: interval(summary.matchingP95Ms, ' ms'),
    },
  ];
  if (summary.recoveryPct) {
    kpis.push({
      label: 'Recuperación tras incidencias',
      value: `${formatNumber(summary.recoveryPct.mean)} %`,
      hint: 'Pasajeros afectados que encuentran otro viaje',
      interval: interval(summary.recoveryPct, ' %'),
    });
  }
  return kpis;
}
