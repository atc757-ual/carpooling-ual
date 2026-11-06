import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';

// Una parada del trayecto: el sitio, su detalle debajo y, si se sabe, la hora
export interface RouteStop {
  name: string;
  detail: string;
  // HH:MM
  time?: string;
}

// Línea de ruta (RouteTimeline de la guía): cada parada con su punto, vacío
// el origen y relleno el destino, unidos por una línea; a la izquierda, la
// hora de cada parada si la tiene
@Component({
  selector: 'app-route-timeline',
  templateUrl: './route-timeline.html',
  styleUrl: './route-timeline.scss',
})
export class RouteTimeline {
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly currentLang = toSignal(this.transloco?.langChanges$ ?? EMPTY);

  readonly stops = input.required<readonly RouteStop[]>();
  readonly ariaLabel = input<string | undefined>(undefined);

  // Con horas, la primera línea de cada parada crece a la altura de un título
  readonly hasTimes = computed(() => this.stops().some((stop) => stop.time));

  protected readonly timelineAriaLabel = computed(() => {
    this.currentLang();
    return this.ariaLabel() ?? this.transloco?.translate('common.routeTimeline.aria') ?? 'Trayecto';
  });
}
