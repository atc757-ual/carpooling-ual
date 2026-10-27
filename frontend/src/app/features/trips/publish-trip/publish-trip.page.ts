import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  IonButton,
  IonCheckbox,
  IonContent,
  IonDatetime,
  IonDatetimeButton,
  IonIcon,
  IonInput,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular';
import {
  addOutline,
  calendarOutline,
  carOutline,
  ellipseOutline,
  locationOutline,
  removeOutline,
  swapHorizontalOutline,
  timeOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { PublishedTrip, Vehicle } from '../../../core/models/driver.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import { CAMPUS_NAME } from '../../matching/campus';
import { PlaceField } from '../../matching/place-field/place-field';
import { getDefaultTime } from '../../matching/trip-search-form/trip-search-form';

// Matrícula española actual (1234BCD; se admiten espacio y guion al escribirla)
const PLATE_PATTERN = /^\d{4}[ -]?[B-DF-HJ-NP-TV-Z]{3}$/i;
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 8;
const DEFAULT_CAPACITY = 4;
export const DETOURS = [5, 10, 15, 20] as const;
const DEFAULT_DETOUR = 10;

type LoadState = 'loading' | 'error' | 'ready';

// Fecha local en formato ISO (2026-10-27), la que espera ion-datetime
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Fecha y hora locales («2026-10-27», «07:40») en ISO UTC para la API
export function toDepartureAt(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// Publicar viaje (conductor, RF-04). Sin vehículos, primero «Antes de tu
// primer viaje» (matrícula y plazas); después, el formulario: trayecto (una
// dirección y un parking del campus, en un sentido u otro), fecha y hora de
// salida, vehículo, plazas ofrecidas (hasta la capacidad del vehículo),
// desvío máximo y, si aún no la ha aceptado, la declaración responsable
// (RF-21). Al publicar, el resumen del viaje y «Publicar otro»
@Component({
  selector: 'app-publish-trip',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonCheckbox,
    IonContent,
    IonDatetime,
    IonDatetimeButton,
    IonIcon,
    IonInput,
    IonModal,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonicFormStatus,
    PlaceField,
    RouteTimeline,
  ],
  templateUrl: './publish-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './publish-trip.page.scss'],
})
export class PublishTripPage implements OnInit {
  private readonly driver = inject(DriverService);
  private readonly places = inject(PlacesService);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly loadState = signal<LoadState>('loading');
  readonly vehicles = signal<readonly Vehicle[]>([]);
  readonly hasDeclared = signal(false);
  readonly isSaving = signal(false);
  // El viaje recién publicado (pantalla de confirmación)
  readonly published = signal<PublishedTrip | null>(null);

  readonly vehicleForm = this.formBuilder.group({
    plate: ['', [Validators.required, Validators.pattern(PLATE_PATTERN)]],
    capacity: [
      DEFAULT_CAPACITY,
      [Validators.required, Validators.min(MIN_CAPACITY), Validators.max(MAX_CAPACITY)],
    ],
  });

  readonly tripForm = this.formBuilder.group({
    // La dirección de fuera del campus (origen al ir, destino al volver)
    place: new FormControl<SearchPlace | null>(null, Validators.required),
    parking: ['', Validators.required],
    isToCampus: [true],
    date: [toIsoDate(new Date())],
    time: [getDefaultTime(new Date())],
    vehicleId: ['', Validators.required],
    seats: [1, [Validators.required, Validators.min(1)]],
    maxDetourMin: [DEFAULT_DETOUR],
    declaration: [false],
  });

  private readonly tripValue = toSignal(this.tripForm.valueChanges, {
    initialValue: this.tripForm.getRawValue(),
  });

  readonly isToCampus = computed(() => this.tripValue().isToCampus ?? true);
  readonly selectedVehicle = computed(() =>
    this.vehicles().find(({ id }) => id === this.tripValue().vehicleId),
  );
  // Plazas ofrecidas: de 1 a la capacidad del vehículo elegido
  readonly maxSeats = computed(() => this.selectedVehicle()?.capacity ?? 1);
  readonly canRemoveSeat = computed(() => Number(this.tripValue().seats) > 1);
  readonly canAddSeat = computed(() => Number(this.tripValue().seats) < this.maxSeats());

  protected readonly parkings = this.places.parkings;
  protected readonly campusName = CAMPUS_NAME;
  protected readonly detours = DETOURS;
  protected readonly minDate = toIsoDate(new Date());
  protected readonly icons = {
    origin: ellipseOutline,
    destination: locationOutline,
    calendar: calendarOutline,
    clock: timeOutline,
    car: carOutline,
    remove: removeOutline,
    add: addOutline,
    swap: swapHorizontalOutline,
  };

  constructor() {
    // El primer parking en cuanto llegan
    effect(() => {
      const [first] = this.parkings();
      const control = this.tripForm.controls.parking;
      if (first && !untracked(() => control.value)) {
        control.setValue(first.id);
      }
    });
    // Al cambiar de vehículo, las plazas no pasan de su capacidad
    effect(() => {
      const max = this.maxSeats();
      const control = this.tripForm.controls.seats;
      control.setValidators([Validators.required, Validators.min(1), Validators.max(max)]);
      if (untracked(() => Number(control.value)) > max) {
        control.setValue(max);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loadState.set('loading');
    try {
      const [status, vehicles] = await Promise.all([
        this.driver.getStatus(),
        this.driver.listVehicles(),
        this.places.loadParkings(),
      ]);
      this.hasDeclared.set(status.hasLicenseDeclared);
      this.setVehicles(vehicles);
      this.loadState.set('ready');
    } catch {
      this.loadState.set('error');
    }
  }

  handleSwap(): void {
    const { isToCampus } = this.tripForm.controls;
    isToCampus.setValue(!isToCampus.value);
  }

  changeSeats(delta: number): void {
    const { seats } = this.tripForm.controls;
    seats.setValue(Math.min(this.maxSeats(), Math.max(1, Number(seats.value) + delta)));
  }

  protected isPlaceInvalid(): boolean {
    const { place } = this.tripForm.controls;
    return place.touched && place.invalid;
  }

  async handleRegisterVehicle(): Promise<void> {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }
    const { plate, capacity } = this.vehicleForm.getRawValue();
    await this.save(async () => {
      const vehicle = await this.driver.registerVehicle({
        plate: plate.replaceAll(/[ -]/g, '').toUpperCase(),
        capacity: Number(capacity),
      });
      this.setVehicles([...this.vehicles(), vehicle]);
    });
  }

  async handlePublish(): Promise<void> {
    const {
      place,
      parking: parkingId,
      isToCampus,
      date,
      time,
      ...values
    } = this.tripForm.getRawValue();
    const parking = this.parkings().find(({ id }) => id === parkingId);
    const needsDeclaration = !this.hasDeclared() && !values.declaration;
    if (this.tripForm.invalid || !place || !parking || needsDeclaration) {
      this.tripForm.markAllAsTouched();
      return;
    }
    const placePoint = { type: 'Point' as const, coordinates: place.coordinates };
    await this.save(async () => {
      if (!this.hasDeclared()) {
        await this.driver.acceptDeclaration();
        this.hasDeclared.set(true);
      }
      const trip = await this.driver.publishTrip({
        vehicleId: values.vehicleId,
        origin: isToCampus ? placePoint : parking.location,
        destination: isToCampus ? parking.location : placePoint,
        departureAt: toDepartureAt(date, time),
        offeredSeats: Number(values.seats),
        maxDetourMin: values.maxDetourMin,
      });
      this.published.set(trip);
      void this.toast.showSuccess('Viaje publicado.');
    });
  }

  // Otro viaje: mismo vehículo y trayecto, nueva hora
  handlePublishAnother(): void {
    this.published.set(null);
    this.tripForm.patchValue({ time: getDefaultTime(new Date()) });
  }

  // Paradas del viaje publicado (RouteTimeline), con la hora de salida
  protected publishedStops(): RouteStop[] {
    const { place, parking: parkingId, isToCampus, time } = this.tripForm.getRawValue();
    const parking = this.parkings().find(({ id }) => id === parkingId);
    const campus: RouteStop = { name: CAMPUS_NAME, detail: parking?.name ?? '' };
    const outside: RouteStop = { name: place?.name ?? '', detail: place?.locality ?? '' };
    return isToCampus ? [{ ...outside, time }, campus] : [{ ...campus, time }, outside];
  }

  private setVehicles(vehicles: readonly Vehicle[]): void {
    this.vehicles.set(vehicles);
    const { vehicleId } = this.tripForm.controls;
    if (!vehicles.some(({ id }) => id === vehicleId.value) && vehicles[0]) {
      vehicleId.setValue(vehicles[0].id);
    }
  }

  // Guarda con el botón cargando; los errores, en un aviso, sin perder lo escrito
  private async save(action: () => Promise<void>): Promise<void> {
    this.isSaving.set(true);
    try {
      await action();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSaving.set(false);
    }
  }
}
