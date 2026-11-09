import {
  SimulationSweep,
  SweepParameter,
  SweepVariant,
} from '../../../../core/models/admin-simulation.model';
import { formatNumber } from '../simulation-labels';

// Textos y validación del análisis de sensibilidad. Funciones puras

export const MIN_VALUES = 2;
export const MAX_VALUES = 5;
const MIN_PERCENT = 5;
const MAX_PERCENT = 100;

// Los valores de la memoria (capítulo 11): reparto modal 20/30/50 % y, para
// la adopción, alrededor del 30 % de referencia
export const DEFAULT_VALUES: Readonly<Record<SweepParameter, string>> = {
  ownCarShare: '20, 30, 50',
  adoptionRate: '10, 30, 50',
};

// «20, 30, 50» → [0.2, 0.3, 0.5]; null si no son de 2 a 5 porcentajes
// distintos entre el 5 y el 100
export function parseValues(text: string): number[] | null {
  const parts = text
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const percents = parts.map(Number);
  const isValid =
    percents.length >= MIN_VALUES &&
    percents.length <= MAX_VALUES &&
    new Set(percents).size === percents.length &&
    percents.every((p) => Number.isInteger(p) && p >= MIN_PERCENT && p <= MAX_PERCENT);
  return isValid ? percents.map((p) => p / 100) : null;
}

// «Variante 2 de 3 · 12/30 réplicas», «Terminado», «Parado»
export function sweepProgressLabel(sweep: SimulationSweep): string {
  if (sweep.status === 'finished') {
    return 'Terminado';
  }
  if (sweep.status === 'stopped') {
    return 'Parado: una variante falló o se canceló';
  }
  const started = sweep.variants.filter((v) => v.runId !== null);
  const current = started.at(-1);
  const total = sweep.variants.length;
  return `Variante ${started.length} de ${total} · ${current?.progress ?? 0}/${sweep.replicas} réplicas`;
}

// Parte completada, de 0 a 1, contando las réplicas de cada variante
export function sweepProgress(sweep: SimulationSweep): number {
  const total = sweep.variants.length * sweep.replicas;
  const done = sweep.variants.reduce((sum, v) => sum + v.progress, 0);
  return total > 0 ? done / total : 0;
}

export interface SweepRow {
  value: string;
  avoided: string;
  covered: string;
  test: string;
  criterion: string;
}

// Una fila de la tabla por variante (la misma información que el gráfico)
export function sweepRow(variant: SweepVariant): SweepRow {
  const value = `${formatNumber(variant.value * 100, 0)} %`;
  if (variant.vehiclesAvoidedPct === null) {
    const pending = variant.status === null ? 'Pendiente' : 'En curso';
    return { value, avoided: pending, covered: '—', test: '—', criterion: '—' };
  }
  const ci = `${formatNumber(variant.vehiclesAvoidedCiLow ?? 0)}–${formatNumber(variant.vehiclesAvoidedCiHigh ?? 0)}`;
  return {
    value,
    avoided: `${formatNumber(variant.vehiclesAvoidedPct)} % (IC ${ci})`,
    covered: `${formatNumber(variant.requestsCoveredPct ?? 0)} %`,
    test: variant.rejectsNull ? 'Se rechaza' : 'No se rechaza',
    criterion: variant.criterionMet ? 'Cumplido' : 'No cumplido',
  };
}
