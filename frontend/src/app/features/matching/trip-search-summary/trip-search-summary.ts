import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { createOutline } from 'ionicons/icons';
import { TripSearch } from '../../../core/models/trip-search.model';
import { CAMPUS_NAME, getEntranceName } from '../campus-entrances';
import { shiftTime } from '../trip-search-form/trip-search-form';

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

// Una parada del trayecto: el sitio y, debajo, su detalle
export interface RouteStop {
  name: string;
  detail: string;
}

// «2026-10-27» → «27 oct» (en hora local: new Date('2026-10-27') sería UTC)
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return DATE_FORMAT.format(new Date(year, month - 1, day));
}

// Resumen de una búsqueda, con el botón de editarla: el trayecto como línea de
// ruta (círculo vacío el origen, punto relleno el destino, como RouteTimeline
// de la guía) y debajo «27 oct · llegada 08:00 ±20 min · 1 plaza» y «Margen de
// llegada: 07:40–08:20» (al volver, de salida)
@Component({
  selector: 'app-trip-search-summary',
  imports: [IonButton, IonIcon],
  templateUrl: './trip-search-summary.html',
  styleUrl: './trip-search-summary.scss',
})
export class TripSearchSummary {
  readonly search = input.required<TripSearch>();
  readonly edit = output<void>();

  // Origen y destino: el lugar escrito a mano y el campus con su entrada
  readonly stops = computed<[RouteStop, RouteStop]>(() => {
    const { place, entrance, direction } = this.search();
    const campus: RouteStop = { name: CAMPUS_NAME, detail: getEntranceName(entrance) };
    return direction === 'to-campus'
      ? [{ name: place, detail: 'Recogida' }, campus]
      : [campus, { name: place, detail: 'Llegada' }];
  });

  private readonly timeType = computed(() =>
    this.search().direction === 'to-campus' ? 'llegada' : 'salida',
  );

  // «27 oct · llegada 08:00 ±20 min · 1 plaza»
  readonly details = computed(() => {
    const { date, time, margin, seats } = this.search();
    const seatsText = seats === 1 ? '1 plaza' : `${seats} plazas`;
    return `${formatShortDate(date)} · ${this.timeType()} ${time} ±${margin} min · ${seatsText}`;
  });

  // «Margen de llegada: 07:40–08:20»
  readonly window = computed(() => {
    const { time, margin } = this.search();
    const from = shiftTime(time, -margin);
    const to = shiftTime(time, margin);
    return `Margen de ${this.timeType()}: ${from}–${to}`;
  });

  protected readonly editIcon = createOutline;
}
