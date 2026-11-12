import { NgTemplateOutlet } from '@angular/common';
import { Component, effect, input, TemplateRef, viewChild } from '@angular/core';
import { IonCard, IonCardContent, IonContent, IonIcon, IonModal } from '@ionic/angular';
import { LiveSheetController } from '../../shared/utils/desktop-query.util';
import type { LiveTripStatus } from './passenger-requests/live-trip-map/live-trip-map';

// La tarjeta «En directo» de las pantallas En curso (pasajero y conductor):
// el título, la etiqueta de los minutos y las tres etapas

// A menos de esto del destino, la etapa «Llegada» pasa a ser la actual (la
// misma distancia que «Terminar viaje» da por buena). Solo en la ida al
// campus: en la vuelta, cada pasajero se baja en un sitio
export const ARRIVING_METERS = 300;

export type JourneyStageState = 'done' | 'current' | 'upcoming';

export interface JourneyStage {
  label: string;
  state: JourneyStageState;
}

// Las tres etapas, hechas hasta la actual (0, 1 o 2)
export function journeyStages(labels: readonly string[], current: number): JourneyStage[] {
  return labels.map((label, index) => {
    let state: JourneyStageState = 'upcoming';
    if (index < current) {
      state = 'done';
    } else if (index === current) {
      state = 'current';
    }
    return { label, state };
  });
}

// Índice de la etapa actual (0: recogida, 1: en ruta, 2: llegando al destino)
export function stageIndex(isFirstStage: boolean, isNearDestination: boolean): number {
  if (isFirstStage) {
    return 0;
  }
  return isNearDestination ? 2 : 1;
}

export function isArriving(destinationMeters: number | null): boolean {
  return destinationMeters !== null && destinationMeters <= ARRIVING_METERS;
}

// «Rumbo al campus», «Rumbo a casa» o, ya cerca, «Llegando al campus»
export function headingTo(isToCampus: boolean, isNear: boolean): string {
  if (isToCampus) {
    return isNear ? 'Llegando al campus' : 'Rumbo al campus';
  }
  return 'Rumbo a casa';
}

// La etiqueta de los minutos: «En destino en 10 min»; con 1 o menos, «Llegando»
export function etaTag(minutes: number, prefix: string): string {
  const rounded = Math.round(minutes);
  return rounded <= 1 ? 'Llegando' : `${prefix} en ${rounded} min`;
}

export function liveEtaText(
  status: LiveTripStatus | null,
  isHeadingToPickup: boolean,
  pickupPrefix: string,
  staleLabel: string,
): string | null {
  if (!status) {
    return null;
  }
  if (status.isStale) {
    return staleLabel;
  }
  const minutes = isHeadingToPickup ? status.pickupMinutes : status.destinationMinutes;
  const prefix = isHeadingToPickup ? pickupPrefix : 'En destino';
  return minutes === null ? null : etaTag(minutes, prefix);
}

@Component({
  selector: 'app-live-trip-hero',
  imports: [IonCard, IonCardContent, IonIcon],
  styleUrl: './live-trip.scss',
  template: `
    <ion-card class="live-hero">
      <ion-card-content aria-live="polite">
        <div class="live-hero__head">
          <h2 class="live-hero__title">{{ title() }}</h2>
          @if (eta(); as tag) {
            <span class="live-hero__tag">{{ tag }}</span>
          }
        </div>
        <p class="live-hero__text">
          <ion-icon [icon]="icon()" aria-hidden="true" />
          <span class="live-hero__place">{{ place() }}</span>
        </p>
        <ol class="live-journey" aria-label="Etapas de tu viaje">
          @for (stage of stages(); track stage.label) {
            <li
              class="live-journey__stage"
              [class.live-journey__stage--current]="stage.state === 'current'"
              [class.live-journey__stage--done]="stage.state === 'done'"
              [attr.aria-current]="stage.state === 'current' ? 'step' : null"
            >
              {{ stage.label }}
            </li>
          }
        </ol>
      </ion-card-content>
    </ion-card>
  `,
})
export class LiveTripHero {
  readonly title = input.required<string>();
  readonly eta = input<string | null>(null);
  readonly icon = input.required<string>();
  readonly place = input.required<string>();
  readonly stages = input.required<readonly JourneyStage[]>();
}

@Component({
  selector: 'app-live-trip-sheet',
  imports: [NgTemplateOutlet, IonContent, IonModal],
  styleUrl: './live-trip.scss',
  template: `
    @if (!sheet().isDesktop()) {
      <ion-modal
        class="live-sheet"
        [isOpen]="sheet().isOpen()"
        [breakpoints]="sheet().breakpoints"
        [initialBreakpoint]="sheet().initialBreakpoint"
        [backdropBreakpoint]="1"
        [canDismiss]="sheet().canDismiss"
        [backdropDismiss]="false"
        [handle]="true"
        handleBehavior="cycle"
        (ionBreakpointDidChange)="sheet().breakpoint.set($event.detail.breakpoint)"
      >
        <ng-template>
          <ion-content>
            <section class="live-sheet__body" aria-label="Tu viaje ahora">
              <ng-container [ngTemplateOutlet]="content()" />
            </section>
          </ion-content>
        </ng-template>
      </ion-modal>
    }
  `,
})
export class LiveTripSheet {
  readonly sheet = input.required<LiveSheetController>();
  readonly content = input.required<TemplateRef<unknown>>();

  private readonly modal = viewChild(IonModal);

  constructor() {
    effect(() => this.sheet().setModal(this.modal()));
  }
}
