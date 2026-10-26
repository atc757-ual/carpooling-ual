import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular';
import {
  calendarOutline,
  peopleOutline,
  searchOutline,
  swapHorizontalOutline,
  timeOutline,
} from 'ionicons/icons';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';

export const CAMPUS = 'Campus UAL';
const PLACE_MAX_LENGTH = 120;
// Llegada a las 8:00 por defecto (la primera clase de la mañana)
const DEFAULT_ARRIVAL = '08:00';
// Margen sobre la hora de llegada, en minutos
export const MARGINS = [10, 20, 30] as const;
const DEFAULT_MARGIN = 20;
// Plazas que se buscan (un coche lleva como mucho 4 pasajeros)
const MIN_SEATS = 1;
const MAX_SEATS = 4;
const MINUTES_PER_DAY = 24 * 60;

// Fecha local en formato ISO (2026-10-27), la que espera ion-datetime
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function tomorrow(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

// «08:00» ± minutos, en el mismo formato y dentro del día
export function shiftTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total =
    (((hours * 60 + mins + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Búsqueda de viajes (pasajero): trayecto (origen y destino, el campus por
// defecto), fecha, margen, hora de llegada y plazas. Debajo, qué llegadas se
// verán con ese margen. Al buscar lleva a la pestaña Buscar con los datos en la
// URL, donde se mostrarán los resultados. El origen es texto libre: sugerir
// direcciones necesita un buscador de lugares (pendiente)
@Component({
  selector: 'app-trip-search-form',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonDatetime,
    IonDatetimeButton,
    IonIcon,
    IonInput,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonicFormStatus,
  ],
  templateUrl: './trip-search-form.html',
  styleUrl: './trip-search-form.scss',
})
export class TripSearchForm {
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({
    origin: ['', [Validators.required, Validators.maxLength(PLACE_MAX_LENGTH)]],
    destination: [CAMPUS, [Validators.required, Validators.maxLength(PLACE_MAX_LENGTH)]],
    date: [toIsoDate(tomorrow())],
    margin: [DEFAULT_MARGIN],
    arrival: [DEFAULT_ARRIVAL],
    seats: [MIN_SEATS, [Validators.required, Validators.min(MIN_SEATS), Validators.max(MAX_SEATS)]],
  });

  // El formulario no es un signal: su valor, para el resumen de debajo
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  // «Verás llegadas entre las 07:40 y las 08:20»
  readonly arrivalWindow = computed(() => {
    const { arrival = DEFAULT_ARRIVAL, margin = DEFAULT_MARGIN } = this.value();
    return { from: shiftTime(arrival, -margin), to: shiftTime(arrival, margin) };
  });

  protected readonly minDate = toIsoDate(new Date());
  protected readonly margins = MARGINS;
  protected readonly minSeats = MIN_SEATS;
  protected readonly maxSeats = MAX_SEATS;
  protected readonly calendarIcon = calendarOutline;
  protected readonly clockIcon = timeOutline;
  protected readonly seatsIcon = peopleOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly swapIcon = swapHorizontalOutline;

  // Cambia el origen por el destino (p. ej. para volver del campus)
  handleSwap(): void {
    const { origin, destination } = this.form.getRawValue();
    this.form.patchValue({ origin: destination, destination: origin });
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { origin, destination, date, margin, arrival, seats } = this.form.getRawValue();
    await this.router.navigate(['/tabs/search'], {
      queryParams: { from: origin.trim(), to: destination.trim(), date, arrival, margin, seats },
    });
  }
}
