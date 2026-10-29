import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonIcon, IonSelect, IonSelectOption, ModalController } from '@ionic/angular';
import {
  ellipseOutline,
  leafOutline,
  locationOutline,
  searchOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { SearchPlace, TripSearch } from '../../../core/models/trip-search.model';
import { PlacesService } from '../../../core/services/places/places.service';
import { DatetimeField } from '../../../shared/components/ui/datetime-field/datetime-field';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { CAMPUS_NAME } from '../campus';
import { LocationModal } from '../location-modal/location-modal';
import { PlaceField } from '../place-field/place-field';
import { MARGINS, MAX_SEATS, MIN_SEATS } from '../trip-search';
import { TripSearchStateService } from '../trip-search-state.service';
import { distanceKm, estimateTripImpact } from '../trip-impact';
import { LocationService } from '../../../core/services/location/location.service';

// La hora por defecto: dentro de media hora, de 5 en 5 minutos como el
// selector
// A menos de esta distancia de un parking, se está en el campus
const AT_CAMPUS_KM = 1;
// A menos de esta distancia, la dirección guardada es donde se está ahora
const SAME_PLACE_KM = 0.3;

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

// Búsqueda de viajes (pasajero): trayecto (una dirección elegida de las
// sugerencias y un parking del campus; por defecto, hacia el campus, y el
// botón de cambiar le da la vuelta), fecha (de hoy a dentro de un mes), hora
// (de llegada al campus o de salida del campus), margen y plazas. Debajo, qué
// viajes se verán. Al buscar guarda la búsqueda (TripSearchStateService,
// compartida con Buscar) y lleva a la pestaña Buscar, donde se muestran los
// resultados. Sale relleno con la última búsqueda y la sigue: en Inicio,
// aunque la pestaña ya esté abierta, se rellena con lo buscado en Buscar
@Component({
  selector: 'app-trip-search-form',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    DatetimeField,
    PlaceField,
    SeatStepper,
  ],
  templateUrl: './trip-search-form.html',
  styleUrl: './trip-search-form.scss',
})
export class TripSearchForm implements OnInit {
  private readonly router = inject(Router);
  private readonly searchState = inject(TripSearchStateService);
  private readonly places = inject(PlacesService);
  private readonly location = inject(LocationService);
  private readonly placeField = viewChild(PlaceField);

  // La ubicación del momento está en el campus: lo más seguro es que vuelva a
  // casa, y se le propone cambiar el sentido
  readonly isAtCampus = signal(false);
  private readonly modalController = inject(ModalController);

  // Avisa de cada búsqueda (en Buscar, para cerrar el formulario aunque se
  // repita la misma)
  readonly searched = output<TripSearch>();

  readonly form = inject(NonNullableFormBuilder).group({
    // La dirección de fuera del campus (origen al ir, destino al volver),
    // elegida de las sugerencias; null mientras no se elige
    place: new FormControl<SearchPlace | null>(null, Validators.required),
    // Id del parking del campus (el primero, en cuanto llegan)
    parking: ['', Validators.required],
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

  // Hay una dirección elegida (en Inicio, para ofrecer «Nueva búsqueda»)
  readonly hasPlace = computed(() => Boolean(this.value().place));

  // Lo que importa del horario: al ir, a qué hora se llega; al volver, a qué
  // hora se sale (cuando acaban las clases)
  readonly timeType = computed<TimeType>(() => (this.isToCampus() ? 'arrival' : 'departure'));

  // «0,7»: con coma decimal, en español
  protected formatDecimal(value: number): string {
    return value.toLocaleString('es-ES');
  }

  protected readonly minDate = toIsoDate(new Date());
  protected readonly maxDate = toIsoDate(inOneMonth());
  protected readonly parkings = this.places.parkings;

  // Lo que se ahorra dejando el coche en casa en este trayecto (aproximado:
  // ver trip-impact.ts). Con la dirección y el parking elegidos
  readonly impact = computed(() => {
    const { place, parking } = this.value();
    const campus = this.parkings().find(({ id }) => id === parking);
    return place && campus
      ? estimateTripImpact(place.coordinates, campus.location.coordinates)
      : null;
  });
  protected readonly campusName = CAMPUS_NAME;
  protected readonly margins = MARGINS;
  protected readonly minSeats = MIN_SEATS;
  protected readonly maxSeats = MAX_SEATS;
  protected readonly originIcon = ellipseOutline;
  protected readonly destinationIcon = locationOutline;
  protected readonly impactIcon = leafOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly swapIcon = swapHorizontalOutline;

  constructor() {
    // Con la última búsqueda, o vacío si no hay (nueva búsqueda)
    effect(() => {
      const search = this.searchState.search();
      untracked(() => this.fill(search));
    });
    // Sin parking elegido, el primero en cuanto llegan
    effect(() => {
      const [first] = this.parkings();
      const control = this.form.controls.parking;
      if (first && !untracked(() => control.value)) {
        control.setValue(first.id);
      }
    });
  }

  ngOnInit(): void {
    void this.prefillOrigin();
  }

  // Ahorra escribir el origen: con el permiso de ubicación YA concedido (no se
  // pide al abrir), sin dirección elegida y yendo al campus, rellena el campo
  // con la dirección del momento. Si está en el campus (a menos de 1 km de un
  // parking), no lo rellena: propone volver a casa. La ubicación no se guarda
  private async prefillOrigin(): Promise<void> {
    await this.places.loadParkings();
    const saved = this.value().place;
    // Con una búsqueda guardada solo se mira si es donde está ahora; sin ella,
    // solo al ir al campus
    if ((!saved && !this.isToCampus()) || (await this.location.checkPermission()) !== 'granted') {
      return;
    }
    const point = await this.location.getCurrentPoint().catch(() => null);
    if (!point) {
      return;
    }
    if (saved) {
      // La dirección guardada es la de aquí: el botón lo muestra (late)
      if (distanceKm(point, saved.coordinates) < SAME_PLACE_KM) {
        this.placeField()?.markFromLocation();
      }
      return;
    }
    const isAtCampus = this.parkings().some(
      ({ location }) => distanceKm(point, location.coordinates) < AT_CAMPUS_KM,
    );
    if (isAtCampus) {
      this.isAtCampus.set(true);
      return;
    }
    await this.placeField()?.fillQuietly(point);
  }

  // «¿Vuelves a casa?»: cambia el sentido y deja de proponerlo
  handleGoHome(): void {
    this.isAtCampus.set(false);
    this.handleSwap();
  }

  // En rojo con «Elige una dirección de la lista.»
  protected isPlaceInvalid(): boolean {
    const { place } = this.form.controls;
    return place.touched && place.invalid;
  }

  // Limpiar: olvida la búsqueda (también en Buscar) y deja el formulario como
  // nuevo (aunque no se hubiera buscado lo escrito)
  clear(): void {
    this.searchState.clear();
    this.fill(null);
  }

  private fill(search: TripSearch | null): void {
    if (!search) {
      this.form.reset();
      this.form.patchValue({
        parking: this.parkings()[0]?.id ?? '',
        date: toIsoDate(new Date()),
        time: getDefaultTime(new Date()),
      });
      return;
    }
    const { direction, parking, ...values } = search;
    this.form.patchValue({
      ...values,
      parking: parking.id,
      isToCampus: direction === 'to-campus',
    });
  }

  // «Ver en el mapa»: el parking elegido, en el mapa y sin poder moverlo
  async handleViewParking(): Promise<void> {
    const parking = this.parkings().find(({ id }) => id === this.form.controls.parking.value);
    if (!parking) {
      return;
    }
    const modal = await this.modalController.create({
      component: LocationModal,
      componentProps: {
        viewPoint: parking.location.coordinates,
        viewTitle: `${CAMPUS_NAME} · ${parking.name}`,
      },
      cssClass: 'location-dialog',
    });
    await modal.present();
  }

  // Cambia el sentido: ir al campus o volver de él
  handleSwap(): void {
    this.form.controls.isToCampus.setValue(!this.form.controls.isToCampus.value);
  }

  async handleSubmit(): Promise<void> {
    const { place, parking: parkingId, isToCampus, seats, ...values } = this.form.getRawValue();
    const parking = this.parkings().find(({ id }) => id === parkingId);
    if (this.form.invalid || !place || !parking) {
      this.form.markAllAsTouched();
      return;
    }
    const search: TripSearch = {
      ...values,
      place,
      parking: { id: parking.id, name: parking.name },
      direction: isToCampus ? 'to-campus' : 'from-campus',
      seats: Number(seats),
    };
    this.searchState.set(search);
    this.searched.emit(search);
    await this.router.navigate(['/tabs/search/results']);
  }
}
