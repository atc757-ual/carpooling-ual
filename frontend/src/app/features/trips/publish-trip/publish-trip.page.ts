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
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { carOutline, ellipseOutline, locationOutline, swapHorizontalOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { PublishedTrip, Vehicle } from '../../../core/models/driver.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { DatetimeField } from '../../../shared/components/ui/datetime-field/datetime-field';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { CAMPUS_NAME } from '../../matching/campus';
import { LocationModal } from '../../matching/location-modal/location-modal';
import { PlaceField } from '../../matching/place-field/place-field';
import { DeclarationModal } from '../declaration-modal/declaration-modal';
import { VehicleForm } from '../vehicle-form/vehicle-form';
import { VehicleModal } from '../vehicle-modal/vehicle-modal';
import { getDefaultTime } from '../../matching/trip-search-form/trip-search-form';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SectionTitle } from '../../tabs/section-title/section-title';

export const DETOURS = [5, 10, 15, 20] as const;
const DEFAULT_DETOUR = 10;
const DATE_LABEL = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

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
// primer viaje» (marca y modelo, matrícula y capacidad); después, el formulario: trayecto (una
// dirección y un parking del campus, en un sentido u otro), fecha y hora de
// salida, vehículo, plazas ofrecidas (hasta la capacidad del vehículo),
// desvío máximo y, si aún no la ha aceptado, la declaración responsable
// (RF-21). Al publicar, el resumen del viaje y «Publicar otro»
@Component({
  selector: 'app-publish-trip',
  imports: [
    SectionTitle,
    ReactiveFormsModule,
    IonButton,
    IonCheckbox,
    IonContent,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonicFormStatus,
    DatetimeField,
    PlaceField,
    RouteTimeline,
    SeatStepper,
    VehicleForm,
  ],
  templateUrl: './publish-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './publish-trip.page.scss'],
})
export class PublishTripPage implements OnInit {
  private readonly driver = inject(DriverService);
  private readonly auth = inject(AuthService);
  private readonly places = inject(PlacesService);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly modalController = inject(ModalController);

  readonly loadState = signal<LoadState>('loading');
  readonly vehicles = signal<readonly Vehicle[]>([]);
  readonly hasDeclared = signal(false);
  readonly isSaving = signal(false);
  // El viaje recién publicado (pantalla de confirmación)
  readonly published = signal<PublishedTrip | null>(null);

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

  // Qué falta para poder publicar (el botón sigue desactivado hasta que no
  // falte nada), o null si está todo
  readonly missingToPublish = computed(() => {
    const { place, parking, vehicleId, declaration } = this.tripValue();
    if (!place) {
      return 'Elige tu dirección para publicar el viaje.';
    }
    if (!parking || !vehicleId) {
      return 'Elige el parking y el vehículo para publicar el viaje.';
    }
    if (!this.hasDeclared() && !declaration) {
      return 'Acepta la declaración para publicar tu primer viaje.';
    }
    return null;
  });
  readonly seatsHint = computed(() => {
    const max = this.maxSeats();
    return `Tu vehículo tiene ${max} ${max === 1 ? 'plaza' : 'plazas'} para pasajeros.`;
  });

  protected readonly parkings = this.places.parkings;
  protected readonly campusName = CAMPUS_NAME;
  protected readonly detours = DETOURS;
  protected readonly minDate = toIsoDate(new Date());
  protected readonly icons = {
    origin: ellipseOutline,
    destination: locationOutline,
    car: carOutline,
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
      // Sin perfil de conductor (aún sin coche) no hay estado ni vehículos que
      // pedir: la pantalla empieza por registrar el vehículo
      if (!this.auth.hasProfile('driver')) {
        await this.places.loadParkings();
        this.hasDeclared.set(false);
        this.setVehicles([]);
        this.loadState.set('ready');
        return;
      }
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

  protected isPlaceInvalid(): boolean {
    const { place } = this.tripForm.controls;
    return place.touched && place.invalid;
  }

  // Primer vehículo registrado: pasa a ser el elegido. Si era el primero de
  // todos, el backend acaba de activar el perfil de conductor: se renueva el
  // token, que es el que lo lleva
  async handleVehicleSaved(vehicle: Vehicle): Promise<void> {
    this.setVehicles([...this.vehicles(), vehicle]);
    if (!this.auth.hasProfile('driver')) {
      await this.auth.refreshAccessToken().catch(() => undefined);
    }
  }

  // «Editar»: sus datos en una ventana; al guardar, se actualiza en la lista
  async handleEditVehicle(vehicle: Vehicle): Promise<void> {
    const modal = await this.modalController.create({
      component: VehicleModal,
      componentProps: { vehicle },
      cssClass: 'info-dialog',
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<Vehicle>();
    if (role === 'saved' && data) {
      this.vehicles.set(this.vehicles().map((item) => (item.id === data.id ? data : item)));
    }
  }

  // «Seat Ibiza · 1234BCD», o solo la matrícula si no tiene modelo
  protected vehicleLabel({ model, plate }: Vehicle): string {
    return model ? `${model} · ${plate}` : plate;
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
    const campusName = `${CAMPUS_NAME} · ${parking.name}`;
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
        originName: isToCampus ? place.name : campusName,
        destinationName: isToCampus ? campusName : place.name,
      });
      this.published.set(trip);
      void this.toast.showSuccess('Viaje publicado.');
    });
  }

  // Otro viaje: mismo vehículo y trayecto, nueva hora
  // «Ver en el mapa»: el parking elegido, en el mapa y sin poder moverlo
  async handleViewParking(): Promise<void> {
    const parking = this.parkings().find(({ id }) => id === this.tripForm.controls.parking.value);
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

  // La declaración completa; «Acepto la declaración» marca la casilla
  async handleReadDeclaration(): Promise<void> {
    const modal = await this.modalController.create({
      component: DeclarationModal,
      cssClass: 'info-dialog',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'accept') {
      this.tripForm.controls.declaration.setValue(true);
    }
  }

  handlePublishAnother(): void {
    this.published.set(null);
    this.tripForm.patchValue({ time: getDefaultTime(new Date()) });
  }

  // Paradas del viaje (RouteTimeline), con la hora de salida: el resumen
  // «Tu viaje» mientras se rellena y la confirmación al publicar. Sin
  // dirección elegida aún no hay recorrido
  readonly stops = computed<RouteStop[] | null>(() => {
    const { place, parking: parkingId, isToCampus = true, time = '' } = this.tripValue();
    if (!place) {
      return null;
    }
    const parking = this.parkings().find(({ id }) => id === parkingId);
    const campus: RouteStop = { name: CAMPUS_NAME, detail: parking?.name ?? '' };
    const outside: RouteStop = { name: place.name, detail: place.locality };
    return isToCampus ? [{ ...outside, time }, campus] : [{ ...campus, time }, outside];
  });

  // «mié, 28 oct» para el resumen
  readonly dateLabel = computed(() => {
    const { date } = this.tripValue();
    return date ? DATE_LABEL.format(new Date(`${date}T00:00:00`)) : '';
  });

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
