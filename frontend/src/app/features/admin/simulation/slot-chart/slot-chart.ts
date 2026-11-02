import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SlotSeries } from '../../../../core/models/admin-simulation.model';

// Medidas del lienzo SVG (unidades del viewBox; se escala al ancho)
const WIDTH = 640;
const HEIGHT = 240;
const PLOT = { left: 40, right: 8, top: 12, bottom: 28 };
const BAR_GAP = 2;
const GROUP_PADDING = 0.2;

export interface ChartBar {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
}

export interface ChartGroup {
  slot: string;
  labelX: number;
  baseline: ChartBar;
  scenario: ChartBar;
}

export interface ChartLayout {
  groups: ChartGroup[];
  ticks: { value: number; y: number }[];
}

// Un máximo «redondo» para el eje (10, 20, 50, 100…) por encima del mayor valor
export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((factor) => factor * magnitude >= value) ?? 10;
  return step * magnitude;
}

// Dos barras por franja (la base y el escenario) y tres marcas en el eje
export function chartLayout(series: readonly SlotSeries[]): ChartLayout {
  const max = niceMax(Math.max(0, ...series.flatMap((s) => [s.vehicles, s.baselineVehicles])));
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const groupWidth = plotWidth / Math.max(series.length, 1);
  const barWidth = (groupWidth * (1 - GROUP_PADDING) - BAR_GAP) / 2;
  const bar = (value: number, x: number): ChartBar => {
    const height = (value / max) * plotHeight;
    return { x, y: PLOT.top + plotHeight - height, width: barWidth, height, value };
  };
  const groups = series.map((point, index) => {
    const start = PLOT.left + index * groupWidth + (groupWidth * GROUP_PADDING) / 2;
    return {
      slot: point.slot,
      labelX: PLOT.left + index * groupWidth + groupWidth / 2,
      baseline: bar(point.baselineVehicles, start),
      scenario: bar(point.vehicles, start + barWidth + BAR_GAP),
    };
  });
  const ticks = [0, max / 2, max].map((value) => ({
    value,
    y: PLOT.top + plotHeight - (value / max) * plotHeight,
  }));
  return { groups, ticks };
}

// Texto para el lector de pantalla: todos los datos de la gráfica
export function chartDescription(
  series: readonly SlotSeries[],
  labels: { baseline: string; scenario: string },
): string {
  const points = series
    .map(
      (s) =>
        `${s.slot}: ${labels.baseline} ${s.baselineVehicles}, ${labels.scenario} ${s.vehicles}`,
    )
    .join('; ');
  return `Vehículos que llegan al campus por franja horaria. ${points}.`;
}

// «Vehículos que llegan al campus por franja horaria»: barras agrupadas de la
// base frente al escenario, en SVG propio (sin librerías de gráficas). Los
// colores salen de los roles del tema; además del color, la base va con borde
// y el escenario relleno, para distinguirlos sin color
@Component({
  selector: 'app-slot-chart',
  templateUrl: './slot-chart.html',
  styleUrl: './slot-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlotChart {
  readonly series = input.required<SlotSeries[]>();
  readonly baselineLabel = input.required<string>();
  readonly scenarioLabel = input.required<string>();

  readonly layout = computed(() => chartLayout(this.series()));
  readonly description = computed(() =>
    chartDescription(this.series(), {
      baseline: this.baselineLabel(),
      scenario: this.scenarioLabel(),
    }),
  );

  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly plot = { ...PLOT, right: WIDTH - PLOT.right, bottom: HEIGHT - PLOT.bottom };
}
