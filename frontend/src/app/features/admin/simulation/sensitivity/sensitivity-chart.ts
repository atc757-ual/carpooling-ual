import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SweepParameter, SweepVariant } from '../../../../core/models/admin-simulation.model';
import { formatNumber, MIN_VEHICLES_AVOIDED_PCT } from '../simulation-labels';
import { niceMax } from '../slot-chart/slot-chart';

// Medidas del lienzo SVG (unidades del viewBox; se escala al ancho)
const WIDTH = 400;
const HEIGHT = 200;
const PLOT = { left: 40, right: 12, top: 12, bottom: 26 };
const CAP = 6;

export interface SweepPoint {
  label: string;
  x: number;
  // null mientras la variante no tiene resultados
  y: number | null;
  ciTop: number | null;
  ciBottom: number | null;
  rejectsNull: boolean;
  tooltip: string;
}

export interface SweepLayout {
  points: SweepPoint[];
  ticks: { value: number; y: number }[];
  targetY: number;
}

// «20 %»: los valores del barrido son proporciones
export function variantLabel(value: number): string {
  return `${formatNumber(value * 100, 0)} %`;
}

export function parameterLabel(parameter: SweepParameter): string {
  return parameter === 'ownCarShare' ? 'en coche propio' : 'de adopción';
}

function tooltipOf(variant: SweepVariant, parameter: SweepParameter): string {
  const label = `${variantLabel(variant.value)} ${parameterLabel(parameter)}`;
  if (variant.vehiclesAvoidedPct === null) {
    return `${label}: sin resultados todavía`;
  }
  const ci = `IC 95 %: ${formatNumber(variant.vehiclesAvoidedCiLow ?? 0)}–${formatNumber(variant.vehiclesAvoidedCiHigh ?? 0)} %`;
  const covered = `${formatNumber(variant.requestsCoveredPct ?? 0)} % de solicitudes cubiertas`;
  const test = variant.rejectsNull ? 'se rechaza HE0' : 'no se rechaza HE0';
  return `${label}: ${formatNumber(variant.vehiclesAvoidedPct)} % de vehículos evitados (${ci}), ${covered}, ${test}`;
}

// Un punto por variante (la media de vehículos evitados) con su intervalo de
// confianza, y la línea del objetivo (15 %). El eje empieza en 0 salvo que
// algún intervalo baje de ahí
export function sweepLayout(
  variants: readonly SweepVariant[],
  parameter: SweepParameter,
): SweepLayout {
  const highs = variants.map((v) => v.vehiclesAvoidedCiHigh ?? v.vehiclesAvoidedPct ?? 0);
  const lows = variants.map((v) => v.vehiclesAvoidedCiLow ?? v.vehiclesAvoidedPct ?? 0);
  const max = niceMax(Math.max(MIN_VEHICLES_AVOIDED_PCT, ...highs));
  const min = Math.min(0, ...lows);
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const toY = (value: number): number =>
    PLOT.top + plotHeight - ((value - min) / (max - min)) * plotHeight;
  const step = plotWidth / Math.max(variants.length, 1);
  const points = variants.map((variant, index) => {
    const mean = variant.vehiclesAvoidedPct;
    return {
      label: variantLabel(variant.value),
      x: PLOT.left + step * index + step / 2,
      y: mean === null ? null : toY(mean),
      ciTop: variant.vehiclesAvoidedCiHigh === null ? null : toY(variant.vehiclesAvoidedCiHigh),
      ciBottom: variant.vehiclesAvoidedCiLow === null ? null : toY(variant.vehiclesAvoidedCiLow),
      rejectsNull: variant.rejectsNull === true,
      tooltip: tooltipOf(variant, parameter),
    };
  });
  const ticks = [min, (min + max) / 2, max].map((value) => ({ value, y: toY(value) }));
  return { points, ticks, targetY: toY(MIN_VEHICLES_AVOIDED_PCT) };
}

// «Vehículos evitados según el supuesto»: un solo dato por variante, así que
// sin leyenda de series; el punto relleno indica que se rechaza HE0 y el hueco
// que no (además del color, la forma). Cada punto lleva su detalle al pasar el
// ratón y la tabla de debajo repite los datos para el lector de pantalla
@Component({
  selector: 'app-sensitivity-chart',
  templateUrl: './sensitivity-chart.html',
  styleUrl: './sensitivity-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SensitivityChart {
  readonly variants = input.required<SweepVariant[]>();
  readonly parameter = input.required<SweepParameter>();

  readonly layout = computed(() => sweepLayout(this.variants(), this.parameter()));
  readonly title = computed(
    () => `Vehículos evitados según el % ${parameterLabel(this.parameter())}`,
  );

  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly plot = { ...PLOT, right: WIDTH - PLOT.right, bottom: HEIGHT - PLOT.bottom };
  protected readonly cap = CAP;
  protected readonly target = MIN_VEHICLES_AVOIDED_PCT;
  protected readonly formatNumber = formatNumber;
}
