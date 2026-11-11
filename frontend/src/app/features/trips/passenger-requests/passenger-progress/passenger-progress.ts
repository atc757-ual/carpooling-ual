import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { checkmark, close } from 'ionicons/icons';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';

export type ProgressStepState = 'done' | 'current' | 'upcoming' | 'stopped';

export interface ProgressStep {
  label: string;
  at: string | null;
  state: ProgressStepState;
}

const TIME = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const DAY_AND_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// «13:03» si es de hoy; si no, «11 nov, 13:03»
export function formatStepTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  return date.toDateString() === now.toDateString() ? TIME.format(date) : DAY_AND_TIME.format(date);
}

// El paso en que se cerró una solicitud sin viaje (o null si sigue su curso)
function stoppedStep(request: SeatRequest, trip: Trip): ProgressStep | null {
  if (trip.status === 'cancelled') {
    return { label: 'Viaje cancelado', at: request.cancelledAt, state: 'stopped' };
  }
  switch (request.status) {
    case 'rejected':
      return {
        label: request.rejectionReason === 'trip_full' ? 'Viaje completo' : 'No aceptada',
        at: request.answeredAt,
        state: 'stopped',
      };
    case 'expired':
      return { label: 'Caducada', at: request.answeredAt, state: 'stopped' };
    case 'cancelled':
      return {
        label: request.rejectionReason === 'no_show' ? 'No te presentaste' : 'Cancelada',
        at: request.cancelledAt,
        state: 'stopped',
      };
    default:
      return null;
  }
}

// Cuántos pasos se han alcanzado (1 solicitada … 4 finalizado)
function reachedSteps(request: SeatRequest, trip: Trip): number {
  if (request.status === 'pending') {
    return 1;
  }
  if (trip.status === 'finished') {
    return 4;
  }
  return trip.status === 'in_progress' ? 3 : 2;
}

// Los pasos de la solicitud del pasajero, con su hora: Solicitada →
// Confirmada → En curso → Finalizado; si se cerró sin viaje, Solicitada y el
// motivo (No aceptada, Caducada, Cancelada…)
export function buildProgressSteps(request: SeatRequest, trip: Trip): ProgressStep[] {
  const sent: ProgressStep = { label: 'Solicitada', at: request.requestedAt, state: 'done' };
  const stopped = stoppedStep(request, trip);
  if (stopped) {
    return [sent, stopped];
  }
  // Hechos los alcanzados; «En curso», resaltado solo mientras el viaje está
  // en marcha (antes de iniciar, ningún paso se marca como actual)
  const reached = reachedSteps(request, trip);
  const isOngoing = request.status === 'accepted' && trip.status === 'in_progress';
  const stateOf = (index: number): ProgressStepState => {
    if (index === 2 && isOngoing) {
      return 'current';
    }
    return index < reached ? 'done' : 'upcoming';
  };
  return [
    sent,
    {
      label: 'Confirmada',
      at: request.status === 'accepted' ? request.answeredAt : null,
      state: stateOf(1),
    },
    { label: 'En curso', at: request.boardedAt ?? null, state: stateOf(2) },
    { label: 'Finalizado', at: null, state: stateOf(3) },
  ];
}

// Progreso de la solicitud del pasajero, con la hora bajo cada paso (sustituye
// al historial). Solo informa: no se puede volver a ningún paso
@Component({
  selector: 'app-passenger-progress',
  imports: [IonIcon],
  template: `
    <ol class="passenger-progress" aria-label="Progreso de tu solicitud">
      @for (step of steps(); track step.label) {
        <li
          class="passenger-progress__step"
          [class]="'passenger-progress__step--' + step.state"
          [attr.aria-current]="step.state === 'current' ? 'step' : null"
        >
          <span class="passenger-progress__dot" aria-hidden="true">
            @if (step.state === 'done') {
              <ion-icon [icon]="doneIcon" />
            } @else if (step.state === 'stopped') {
              <ion-icon [icon]="stoppedIcon" />
            }
          </span>
          <span class="passenger-progress__label">{{ step.label }}</span>
          @if (step.at) {
            <time class="passenger-progress__time" [attr.datetime]="step.at">
              {{ formatTime(step.at) }}
            </time>
          }
        </li>
      }
    </ol>
  `,
  styleUrl: './passenger-progress.scss',
})
export class PassengerProgress {
  readonly request = input.required<SeatRequest>();
  readonly trip = input.required<Trip>();

  protected readonly steps = computed(() => buildProgressSteps(this.request(), this.trip()));
  protected readonly doneIcon = checkmark;
  protected readonly stoppedIcon = close;
  protected readonly formatTime = (iso: string) => formatStepTime(iso);
}
