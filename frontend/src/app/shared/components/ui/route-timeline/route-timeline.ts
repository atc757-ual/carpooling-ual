import { Component, computed, input } from '@angular/core';

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
  readonly stops = input.required<readonly RouteStop[]>();

  // Con horas, la primera línea de cada parada crece a la altura de un título
  readonly hasTimes = computed(() => this.stops().some((stop) => stop.time));
}
