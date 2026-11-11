import { Component, computed, input } from '@angular/core';
import { TripStatus } from '../../../core/models/driver.model';
import { StepIndicator } from '../../../shared/components/ui/step-indicator/step-indicator';

export const TRIP_PROGRESS_STEPS = ['Publicado', 'Confirmado', 'En curso', 'Finalizado'] as const;
// El paso de cada estado, de 1 en adelante (un viaje cancelado o sin
// pasajeros no tiene progreso: no se muestra)
const STEP_BY_STATUS: Record<Exclude<TripStatus, 'cancelled' | 'expired'>, number> = {
  published: 1,
  confirmed: 2,
  in_progress: 3,
  finished: 4,
};

// Progreso de un viaje (publicado → confirmado → en curso → finalizado) con
// los pasos de la guía, solo para informar: no se puede volver a ninguno.
// Lo usan las pantallas de viaje en curso del conductor y del pasajero
@Component({
  selector: 'app-trip-progress',
  imports: [StepIndicator],
  template: `
    <app-step-indicator
      label="Progreso del viaje"
      [steps]="steps"
      [current]="current()"
      [isComplete]="status() === 'finished'"
      [isNavigable]="false"
    />
  `,
})
export class TripProgress {
  readonly status = input.required<Exclude<TripStatus, 'cancelled' | 'expired'>>();

  protected readonly steps = TRIP_PROGRESS_STEPS;
  readonly current = computed(() => STEP_BY_STATUS[this.status()]);
}
