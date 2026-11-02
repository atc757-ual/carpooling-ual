import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SimulationResults, SimulationRun } from '../../../../core/models/admin-simulation.model';
import { comparisonLabel, resultKpis } from '../simulation-labels';
import { SlotChart } from '../slot-chart/slot-chart';

// Resultados de una ejecución terminada: si cumple el criterio, las tarjetas
// de KPI y la gráfica por franja (RF-18, RF-20)
@Component({
  selector: 'app-simulation-results',
  imports: [SlotChart],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationResultsView {
  readonly run = input.required<SimulationRun>();
  readonly results = input.required<SimulationResults>();

  readonly title = computed(() => `Resultados · ${comparisonLabel(this.run())}`);
  readonly kpis = computed(() => resultKpis(this.results(), this.run().baselineScenario));
  readonly criterion = computed(() => {
    const results = this.results();
    const replicas = `${results.replicas}/${this.run().replicas} réplicas`;
    return results.criterionMet
      ? { label: `${replicas} · criterio cumplido`, tone: 'success' }
      : { label: `${replicas} · criterio no cumplido`, tone: 'warning' };
  });
}
