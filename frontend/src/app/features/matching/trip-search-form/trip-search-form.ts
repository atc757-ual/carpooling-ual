import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, OnInit } from '@angular/core';
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
  addOutline,
  calendarOutline,
  ellipseOutline,
  locationOutline,
  peopleOutline,
  removeOutline,
  searchOutline,
  swapHorizontalOutline,
  timeOutline,
} from 'ionicons/icons';
import { CampusEntranceId, TripSearch } from '../../../core/models/trip-search.model';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { CAMPUS_ENTRANCES, DEFAULT_ENTRANCE } from '../campus-entrances';
import {
  MARGINS,
  MAX_SEATS,
  MIN_SEATS,
  PLACE_MAX_LENGTH,
  toSearchParams,
} from '../trip-search-params';

// La hora por defecto: dentro de media hora, de 5 en 5 minutos como el
// selector
const LEAD_MINUTES = 30;
const MINUTE_STEP = 5;
const LAST_TIME = '23:55';
const DEFAULT_MARGIN = 20;
const MINUTES_PER_DAY = 24 * 60;

export type TimeType = 'arrival' | 'departure';

// Fecha local en formato ISO (2026-10-27), la que espera ion-datetime
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Dentro de media hora, redondeada hacia arriba a los 5 minutos (a las 10:52,
// las 11:25); a última hora del día se queda en las 23:55 para no saltar a
// mañana
export function getDefaultTime(now: Date): string {
  const minutes =
    Math.ceil((now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES) / MINUTE_STEP) * MINUTE_STEP;
  return minutes >= MINUTES_PER_DAY ? LAST_TIME : shiftTime('00:00', minutes);
}

// Dentro de un mes (el último día que se puede elegir)
function inOneMonth(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

// «08:00» ± minutos, en el mismo formato y dentro del día
export function shiftTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total =
    (((hours * 60 + mins + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Búsqueda de viajes (pasajero): trayecto (un lugar escrito a mano y una
// entrada del campus; por defecto, hacia el campus, y el botón de cambiar le da
// la vuelta), fecha (de hoy a dentro de un mes), hora (de llegada al campus o
// de salida del campus), margen y plazas. Debajo, qué viajes se verán. Al
// buscar lleva a la pestaña Buscar con los datos en la URL, donde se mostrarán
// los resultados; allí sale relleno con la búsqueda hecha (input search). El
// lugar es texto libre: sugerir direcciones necesita un buscador de lugares
// (pendiente)
@Component({
  selector: 'app-trip-search-form',
  imports: [
    NgTemplateOutlet,
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
export class TripSearchForm implements OnInit {
  private readonly router = inject(Router);

  // La búsqueda con la que sale relleno (al editarla en Buscar)
  readonly search = input<TripSearch | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    // El lugar de fuera del campus (origen al ir, destino al volver)
    place: ['', [Validators.required, Validators.maxLength(PLACE_MAX_LENGTH)]],
    entrance: [DEFAULT_ENTRANCE as CampusEntranceId],
    isToCampus: [true],
    // Hoy, dentro de media hora
    date: [toIsoDate(new Date())],
    margin: [DEFAULT_MARGIN],
    // Hora de llegada al campus o, al volver, de salida del campus
    time: [getDefaultTime(new Date())],
    seats: [MIN_SEATS, [Validators.required, Validators.min(MIN_SEATS), Validators.max(MAX_SEATS)]],
  });

  // El formulario no es un signal: su valor, para el resumen y el sentido
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly isToCampus = computed(() => this.value().isToCampus ?? true);

  // Lo que importa del horario: al ir, a qué hora se llega; al volver, a qué
  // hora se sale (cuando acaban las clases)
  readonly timeType = computed<TimeType>(() => (this.isToCampus() ? 'arrival' : 'departure'));

  // «Verás viajes que llegan al campus entre las 07:40 y las 08:20»
  readonly timeWindow = computed(() => {
    const { time = this.form.controls.time.value, margin = DEFAULT_MARGIN } = this.value();
    return { from: shiftTime(time, -margin), to: shiftTime(time, margin) };
  });

  // Plazas con − y +, entre 1 y 4
  readonly canRemoveSeat = computed(() => Number(this.value().seats) > MIN_SEATS);
  readonly canAddSeat = computed(() => Number(this.value().seats) < MAX_SEATS);

  protected readonly minDate = toIsoDate(new Date());
  protected readonly maxDate = toIsoDate(inOneMonth());
  protected readonly entrances = CAMPUS_ENTRANCES;
  protected readonly margins = MARGINS;
  protected readonly minSeats = MIN_SEATS;
  protected readonly maxSeats = MAX_SEATS;
  protected readonly originIcon = ellipseOutline;
  protected readonly destinationIcon = locationOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly clockIcon = timeOutline;
  protected readonly seatsIcon = peopleOutline;
  protected readonly removeIcon = removeOutline;
  protected readonly addIcon = addOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly swapIcon = swapHorizontalOutline;

  ngOnInit(): void {
    const search = this.search();
    if (search) {
      const { direction, ...values } = search;
      this.form.patchValue({ ...values, isToCampus: direction === 'to-campus' });
    }
  }

  // Cambia el sentido: ir al campus o volver de él
  handleSwap(): void {
    this.form.controls.isToCampus.setValue(!this.form.controls.isToCampus.value);
  }

  // Una plaza más o menos, sin salir de 1 a 4 (el campo puede traer texto)
  changeSeats(delta: number): void {
    const seats = Number(this.form.controls.seats.value) + delta;
    this.form.controls.seats.setValue(Math.min(MAX_SEATS, Math.max(MIN_SEATS, seats)));
    this.form.controls.seats.markAsDirty();
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { isToCampus, seats, ...values } = this.form.getRawValue();
    const search: TripSearch = {
      ...values,
      direction: isToCampus ? 'to-campus' : 'from-campus',
      seats: Number(seats),
    };
    await this.router.navigate(['/tabs/search'], { queryParams: toSearchParams(search) });
  }
}
