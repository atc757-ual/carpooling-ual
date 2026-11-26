import { NgTemplateOutlet } from '@angular/common';
import { Component, effect, ElementRef, input, TemplateRef, viewChild } from '@angular/core';
import { IonCard, IonCardContent, IonContent, IonIcon, IonModal } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Translate } from '../../core/i18n/translate';
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

// La clave de «Rumbo al campus», «Rumbo a casa» o, ya cerca, «Llegando al campus»
export function headingTo(isToCampus: boolean, isNear: boolean): string {
  if (isToCampus) {
    return isNear ? 'live.hero.arrivingCampus' : 'live.hero.toCampus';
  }
  return 'live.hero.toHome';
}

// La etiqueta de los minutos: «En destino en 10 min» (la clave lleva
// {{ minutes }}); con 1 o menos, «Llegando»
export function etaTag(minutes: number, key: string, translate: Translate): string {
  const rounded = Math.round(minutes);
  return rounded <= 1 ? translate('live.hero.arriving') : translate(key, { minutes: rounded });
}

// Las claves de la etiqueta: camino de la recogida y sin posición reciente
export interface LiveEtaKeys {
  pickup: string;
  stale: string;
}

export function liveEtaText(
  status: LiveTripStatus | null,
  isHeadingToPickup: boolean,
  { keys, translate }: { keys: LiveEtaKeys; translate: Translate },
): string | null {
  if (!status) {
    return null;
  }
  if (status.isStale) {
    return translate(keys.stale);
  }
  const minutes = isHeadingToPickup ? status.pickupMinutes : status.destinationMinutes;
  const key = isHeadingToPickup ? keys.pickup : 'live.hero.atDestinationIn';
  return minutes === null ? null : etaTag(minutes, key, translate);
}

@Component({
  selector: 'app-live-trip-hero',
  imports: [IonCard, IonCardContent, IonIcon, TranslocoPipe],
  styleUrl: './live-trip.scss',
  template: `
    <ion-card class="live-hero">
      <ion-card-content aria-live="polite">
        <div class="live-hero__head">
          <h2 class="live-hero__title">{{ title() }}</h2>
          @if (eta(); as tag) {
            <span class="live-hero__tag" [class.live-hero__tag--warning]="warning()">{{
              tag
            }}</span>
          }
        </div>
        <p class="live-hero__text">
          <ion-icon [icon]="icon()" aria-hidden="true" />
          <span class="live-hero__place">{{ place() }}</span>
        </p>
        <!-- Sin posición reciente: lo dice aquí, en ámbar y sin recuadro, en vez
             de un aviso aparte encima del mapa -->
        @if (warning(); as text) {
          <p class="live-hero__warning">{{ text }}</p>
        }
        <ol class="live-journey" [attr.aria-label]="'live.hero.stagesLabel' | transloco">
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
  // Qué pasa si no llegan posiciones (más de 1 min), o null
  readonly warning = input<string | null>(null);
}

@Component({
  selector: 'app-live-trip-sheet',
  imports: [NgTemplateOutlet, IonContent, IonModal, TranslocoPipe],
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
            <section
              #body
              class="live-sheet__body"
              [attr.aria-label]="'live.viajeAhora' | transloco"
            >
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
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');

  constructor() {
    effect(() => this.sheet().setModal(this.modal()));
    // La parada de arriba, a la altura del contenido: se mide cada vez que
    // cambia (otra pastilla, una confirmación…) o cambia el alto de la hoja
    effect((onCleanup) => {
      const body = this.body()?.nativeElement;
      const content = body?.closest('ion-content');
      if (!body || !content || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.fit(body, content));
      observer.observe(body);
      observer.observe(content);
      onCleanup(() => observer.disconnect());
    });
  }

  // Lo que ocupa el contenido con el relleno de la hoja (8px arriba, bajo el
  // asa, y 16px abajo: 1,5rem, en live-trip.scss), en fracción de su alto
  private fit(body: HTMLElement, content: HTMLElement): void {
    if (content.offsetHeight === 0) {
      return;
    }
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const needed = body.offsetHeight + 1.5 * rem;
    this.sheet().fitToContent(needed / content.offsetHeight);
  }
}
