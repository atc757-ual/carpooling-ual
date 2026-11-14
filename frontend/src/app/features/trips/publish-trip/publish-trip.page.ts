import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { carOutline, checkmarkCircleOutline, leafOutline } from 'ionicons/icons';
import { map } from 'rxjs';
import { ApiError } from '../../../core/models/api-error.model';
import {
  PickupMode,
  PublishedTrip,
  PublishingStatus,
  Vehicle,
} from '../../../core/models/driver.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { CelebrationService } from '../../../core/services/ui/celebration.service';
import { PermissionPromptsService } from '../../../core/services/push/permission-prompts.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { DatetimeField } from '../../../shared/components/ui/datetime-field/datetime-field';
import { RouteTimeline } from '../../../shared/components/ui/route-timeline/route-timeline';
import { FaqCard } from '../../../shared/components/ui/faq-card/faq-card';
import { StepIndicator } from '../../../shared/components/ui/step-indicator/step-indicator';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { RouteFields } from '../../matching/route-fields/route-fields';
import { estimateDurationMin } from '../../matching/trip-impact';
import {
  RoutePoint,
  TripRouteMap,
} from '../../../shared/components/ui/trip-route-map/trip-route-map';
import { TripRoute } from '../../../core/models/trip-route.model';

import { DeclarationField } from '../declaration-field/declaration-field';
import {
  DEFAULT_PICKUP_DISTANCE_M,
  PickupModeControls,
  PickupModeField,
} from '../pickup-mode-field/pickup-mode-field';
import { PublishNextSteps } from '../publish-next-steps/publish-next-steps';
import { VehiclePicker } from '../vehicle-picker/vehicle-picker';
import { PUBLISH_FAQS } from './publish-help';
import { withDeclarations } from '../with-declarations';
import {
  buildStops,
  estimateDepartureAt,
  estimateDepartureTime,
  estimateDriverImpact,
  formatDateLabel,
  toPublishTripRequest,
} from './publish-trip.utils';
import { toIsoDate } from '../../../shared/utils/date.util';
import { vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { VehicleColorsStore } from '../../../core/services/catalogs/vehicle-colors.store';

export const DETOURS = [5, 10, 15, 20] as const;
const DEFAULT_DETOUR = 10;
// Plazo mínimo para publicar; el valor inicial se redondea al siguiente
// intervalo de 5 min para mantener al menos una hora de antelación.
const PUBLISH_LEAD_MINUTES = 60;
const DEFAULT_TIME_STEP_MINUTES = 5;
export const STEPS = ['Trayecto', 'Vehículo', 'Revisión', 'Publicado'] as const;
const PUBLISHED_STEP = STEPS.length;

type LoadState = 'loading' | 'error' | 'ready' | 'suspended';

// Al empezar el viaje va hacia el campus y se elige la llegada: la propuesta
// deja, además de la antelación mínima, un margen para el trayecto y el
// desvío (si no, saldría antes de esa hora)
const DEFAULT_ARRIVAL_MARGIN_MINUTES = 45;

// «08:18» (hora local) de una fecha ISO
function toLocalTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getDefaultArrival(now = new Date()): { date: string; time: string } {
  const departure = new Date(
    now.getTime() + (PUBLISH_LEAD_MINUTES + 1 + DEFAULT_ARRIVAL_MARGIN_MINUTES) * 60_000,
  );
  const minuteOfDay = departure.getHours() * 60 + departure.getMinutes();
  const roundedMinute =
    Math.ceil(minuteOfDay / DEFAULT_TIME_STEP_MINUTES) * DEFAULT_TIME_STEP_MINUTES;
  departure.setHours(Math.floor(roundedMinute / 60), roundedMinute % 60, 0, 0);
  return {
    date: toIsoDate(departure),
    time: `${String(departure.getHours()).padStart(2, '0')}:${String(departure.getMinutes()).padStart(2, '0')}`,
  };
}

// Publicar viaje (conductor, RF-04) en cuatro pasos (el actual, en la URL:
// ?step=2, para que «Atrás» del navegador vuelva al anterior):
// 1. Trayecto: RouteFields (como en Buscar), fecha, hora y desvío.
// 2. Vehículo: el vehículo (VehiclePicker) y las plazas ofrecidas.
// 3. Revisión: lo que se ahorra, el resumen, la declaración responsable si
//    aún no la ha aceptado (RF-21) y «Publicar viaje».
// 4. Publicado: la enhorabuena, el resumen, «Publicar otro viaje» y «Ver mis
//    viajes» (sin volver a los pasos anteriores).
// A la derecha (en el móvil, al final), las preguntas frecuentes en los pasos
// 1 y 2 y qué pasa después en el 3 y el 4
@Component({
  selector: 'app-publish-trip',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    DatetimeField,
    DeclarationField,
    PickupModeField,
    FaqCard,
    RouteFields,
    RouteTimeline,
    StepIndicator,
    TripRouteMap,
    PublishNextSteps,
    VehiclePicker,
  ],
  templateUrl: './publish-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './publish-trip.page.scss'],
})
export class PublishTripPage implements OnInit {
  private readonly vehicleColors = inject(VehicleColorsStore);
  private readonly driver = inject(DriverService);
  private readonly modalController = inject(ModalController);
  private readonly auth = inject(AuthService);
  private readonly places = inject(PlacesService);
  private readonly toast = inject(ToastService);
  private readonly tripsService = inject(TripsService);
  private readonly permissionPrompts = inject(PermissionPromptsService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly celebration = inject(CelebrationService);
  private readonly initialDeparture = getDefaultArrival();

  readonly loadState = signal<LoadState>('loading');
  // Los vehículos se piden al llegar al paso 2, no antes: el 1 no los necesita
  readonly vehiclesState = signal<LoadState>('loading');
  readonly vehicles = signal<readonly Vehicle[]>([]);
  readonly hasDeclared = signal(false);
  readonly publishingStatus = signal<PublishingStatus | null>(null);
  readonly isSaving = signal(false);
  private accountId = this.auth.currentUser()?.id ?? null;
  private accountGeneration = 0;
  private loadingVehiclesGeneration: number | null = null;
  // El viaje recién publicado (pantalla de confirmación)
  readonly published = signal<PublishedTrip | null>(null);

  readonly tripForm = this.formBuilder.group({
    // La dirección de fuera del campus (origen al ir, destino al volver)
    place: new FormControl<SearchPlace | null>(null, Validators.required),
    parking: ['', Validators.required],
    isToCampus: [true],
    date: [this.initialDeparture.date],
    time: [this.initialDeparture.time],
    vehicleId: ['', Validators.required],
    seats: [1, [Validators.required, Validators.min(1)]],
    maxDetourMin: [DEFAULT_DETOUR],
    // Cómo recoge (solo hacia el campus): en el camino o en sus paradas
    pickupMode: new FormControl<PickupMode>('on_route', { nonNullable: true }),
    maxDetourM: [DEFAULT_PICKUP_DISTANCE_M],
    stops: new FormControl<SearchPlace[]>([], { nonNullable: true }),
    declaration: [false],
  });

  protected readonly pickupControls: PickupModeControls = {
    pickupMode: this.tripForm.controls.pickupMode,
    maxDetourM: this.tripForm.controls.maxDetourM,
    stops: this.tripForm.controls.stops,
  };

  private readonly tripValue = toSignal(this.tripForm.valueChanges, {
    initialValue: this.tripForm.getRawValue(),
  });

  // El paso pedido en la URL, sin pasar del más lejano al que se ha llegado
  // con los botones (rellenar solo el origen o el vehículo no hace avanzar) ni
  // del último posible: sin trayecto no hay paso 2 y sin vehículo no hay 3
  private readonly requestedStep = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => Number(params.get('step')) || 1)),
    { initialValue: 1 },
  );
  private readonly furthestStep = signal(1);
  readonly step = computed(() => {
    if (this.published()) {
      return PUBLISHED_STEP;
    }
    let reachable = 1;
    if (this.isRouteComplete()) {
      reachable = this.tripValue().vehicleId ? 3 : 2;
    }
    return Math.min(this.requestedStep(), this.furthestStep(), reachable);
  });

  // Con el origen (o destino) y el parking elegidos, «Siguiente» se activa
  readonly isRouteComplete = computed(() => {
    const { place, parking } = this.tripValue();
    return Boolean(place && parking);
  });
  // Hacia el campus se elige la llegada (como en Buscar); desde él, la salida
  readonly isArrivalTime = computed(() => this.tripValue().isToCampus ?? true);
  // En paradas hace falta al menos una para seguir
  readonly isMissingStops = computed(() => {
    const { isToCampus = true, pickupMode, stops = [] } = this.tripValue();
    return isToCampus && pickupMode === 'stops' && stops.length === 0;
  });
  // Cómo recoge, en una línea del resumen (desde el campus todos suben allí)
  readonly pickupSummary = computed(() => {
    const { isToCampus = true, pickupMode, maxDetourM, stops = [] } = this.tripValue();
    if (!isToCampus) {
      return null;
    }
    if (pickupMode === 'stops') {
      const count = stops.length === 1 ? '1 parada' : `${stops.length} paradas`;
      return `Recoges en ${count}: ${stops.map(({ name }) => name).join(', ')}`;
    }
    return `Recoges en el camino, a ${maxDetourM ?? DEFAULT_PICKUP_DISTANCE_M} m de tu ruta como mucho`;
  });
  // Ya publicado, las paradas con la hora que calculó el backend
  readonly publishedStops = computed(() =>
    (this.published()?.stops ?? []).map((stop) => ({
      ...stop,
      time: toLocalTime(stop.estimatedAt),
    })),
  );
  // Hacia el campus, la salida aproximada para llegar a tiempo aunque recoja
  // a alguien (null hasta tener el trayecto)
  readonly estimatedDepartureTime = computed(() => {
    const { place, isToCampus = true, time, maxDetourMin = DEFAULT_DETOUR } = this.tripValue();
    const parking = this.selectedParking();
    return isToCampus && place && parking && time
      ? estimateDepartureTime(place, parking, { time, maxDetourMin })
      : null;
  });
  readonly departureTooSoon = computed(() => {
    return this.isDepartureTooSoon();
  });
  readonly publishingSuspendedUntil = computed(() => {
    const until = this.publishingStatus()?.publishingSuspendedUntil;
    return until && new Date(until).getTime() > Date.now() ? until : null;
  });
  readonly publishingSuspendedUntilLabel = computed(() => {
    const until = this.publishingSuspendedUntil();
    return until ? new Date(until).toLocaleDateString('es-ES') : '';
  });

  // Con la llegada, sobre la salida aproximada (la que calculará el backend),
  // con su fecha: llegar poco después de medianoche es salir el día anterior
  private isDepartureTooSoon(): boolean {
    const departure = this.estimatedDepartureAt()?.getTime();
    return (
      departure !== undefined &&
      !Number.isNaN(departure) &&
      departure - Date.now() < PUBLISH_LEAD_MINUTES * 60_000
    );
  }

  // La salida como fecha: la elegida o, hacia el campus, la aproximada (null
  // mientras falte la fecha, la hora o, hacia el campus, el trayecto)
  private estimatedDepartureAt(): Date | null {
    const {
      place,
      date,
      time,
      isToCampus = true,
      maxDetourMin = DEFAULT_DETOUR,
    } = this.tripValue();
    const parking = this.selectedParking();
    if (!date || !time) {
      return null;
    }
    if (!isToCampus) {
      return new Date(`${date}T${time}`);
    }
    return place && parking
      ? estimateDepartureAt(place, parking, { date, time, maxDetourMin })
      : null;
  }

  readonly selectedVehicle = computed(() =>
    this.vehicles().find(({ id }) => id === this.tripValue().vehicleId),
  );
  readonly needsDeclaration = computed(() => !this.hasDeclared() && !this.tripValue().declaration);

  // Lo que se ahorra si se llenan las plazas: cada pasajero deja su coche en
  // casa (aproximado: ver trip-impact.ts)
  readonly impact = computed(() => {
    const { place, seats = 1 } = this.tripValue();
    const parking = this.selectedParking();
    return place && parking ? estimateDriverImpact(place, parking, seats) : null;
  });

  readonly originPoint = computed<RoutePoint | null>(() => {
    const { place, isToCampus = true } = this.tripValue();
    const parking = this.selectedParking();
    if (!place || !parking) {
      return null;
    }
    return isToCampus
      ? { coordinates: place.coordinates, label: place.name }
      : { coordinates: parking.location.coordinates, label: parking.name };
  });

  readonly destinationPoint = computed<RoutePoint | null>(() => {
    const { place, isToCampus = true } = this.tripValue();
    const parking = this.selectedParking();
    if (!place || !parking) {
      return null;
    }
    return isToCampus
      ? { coordinates: parking.location.coordinates, label: parking.name }
      : { coordinates: place.coordinates, label: place.name };
  });

  readonly osrmRoute = signal<TripRoute | null>(null);

  readonly previewRoute = computed<TripRoute | null>(() => {
    const planned = this.osrmRoute();
    if (planned) {
      return planned;
    }
    const origin = this.originPoint();
    const destination = this.destinationPoint();
    if (!origin || !destination) {
      return null;
    }
    const impact = this.impact();
    const durationMin = estimateDurationMin(origin.coordinates, destination.coordinates);
    return {
      tripId: this.published()?.id ?? 'preview',
      distanceKm: impact?.km ?? 0,
      durationMin,
      geometry: {
        type: 'LineString',
        coordinates: [origin.coordinates, destination.coordinates],
      },
      source: 'estimated',
      tripStatus: 'published',
      startedAt: null,
      estimatedArrivalAt: null,
    };
  });

  // Paradas del viaje, con la llegada aproximada: para la revisión y al
  // publicar
  readonly stops = computed(() => {
    const { place, isToCampus = true, time = '', maxDetourMin = DEFAULT_DETOUR } = this.tripValue();
    const parking = this.selectedParking();
    // Ya publicado, la salida que calculó el backend con la ruta
    const published = this.published();
    const departureTime = published ? toLocalTime(published.departureAt) : undefined;
    return place && parking
      ? buildStops(place, parking, { isToCampus, time, maxDetourMin, departureTime })
      : null;
  });

  readonly dateLabel = computed(() => formatDateLabel(this.tripValue().date ?? ''));

  // «Volver a Trayecto»: el paso anterior, por su nombre (al publicar, no hay)
  readonly previousStep = computed(() => {
    const step = this.step();
    return step > 1 && step < PUBLISHED_STEP ? { number: step - 1, name: STEPS[step - 2] } : null;
  });

  constructor() {
    effect(() => {
      const origin = this.originPoint();
      const destination = this.destinationPoint();
      if (!origin || !destination) {
        this.osrmRoute.set(null);
        return;
      }
      void this.tripsService
        .planRoute(origin.coordinates, destination.coordinates)
        .then((route) => this.osrmRoute.set(route))
        .catch(() => this.osrmRoute.set(null));
    });

    effect(() => {
      const userId = this.auth.currentUser()?.id ?? null;
      if (userId === this.accountId) {
        return;
      }
      this.accountId = userId;
      this.accountGeneration += 1;
      this.loadingVehiclesGeneration = null;
      this.vehicles.set([]);
      const departure = getDefaultArrival();
      this.tripForm.reset({
        place: null,
        parking: '',
        isToCampus: true,
        date: departure.date,
        time: departure.time,
        vehicleId: '',
        seats: 1,
        maxDetourMin: DEFAULT_DETOUR,
        pickupMode: 'on_route',
        maxDetourM: DEFAULT_PICKUP_DISTANCE_M,
        stops: [],
        declaration: false,
      });
      this.furthestStep.set(1);
      this.hasDeclared.set(false);
      this.publishingStatus.set(null);
      this.published.set(null);
      this.isSaving.set(false);
      this.vehiclesState.set('loading');
      this.loadState.set(userId === null ? 'ready' : 'loading');
      if (userId !== null) {
        void this.load();
      }
    });
  }

  private readonly selectedParking = computed(() =>
    this.parkings().find(({ id }) => id === this.tripValue().parking),
  );

  protected readonly parkings = this.places.parkings;
  protected readonly detours = DETOURS;
  protected readonly steps = STEPS;
  protected readonly faqs = PUBLISH_FAQS;
  protected readonly minDate = toIsoDate(new Date());
  protected readonly icons = {
    car: carOutline,
    impact: leafOutline,
    published: checkmarkCircleOutline,
  };

  ngOnInit(): void {
    // Al recargar, lo escrito se pierde: se empieza por el primer paso
    if (this.requestedStep() > 1) {
      void this.goToStep(1, { replaceUrl: true });
    }
    void this.load();
  }

  // Lo que necesita el paso 1 (los parkings) y el estado del conductor (paso 3).
  // La lista de vehículos se pide al entrar en el paso 2 (loadVehicles)
  async load(): Promise<void> {
    const generation = this.accountGeneration;
    this.loadState.set('loading');
    try {
      // Sin perfil de conductor (aún sin coche) no hay estado que pedir: el
      // paso 2 empieza por registrar el vehículo
      if (!this.auth.hasProfile('driver')) {
        await this.places.loadParkings();
        if (generation !== this.accountGeneration) {
          return;
        }
        this.hasDeclared.set(false);
        this.vehicles.set([]);
        this.vehiclesState.set('ready');
        this.loadState.set('ready');
        return;
      }
      const [status, publishingStatus] = await Promise.all([
        this.driver.getStatus(),
        this.driver.getPublishingStatus(),
        this.places.loadParkings(),
      ]);
      if (generation !== this.accountGeneration) {
        return;
      }
      this.hasDeclared.set(status.hasLicenseDeclared);
      this.publishingStatus.set(publishingStatus);
      this.loadState.set(this.publishingSuspendedUntil() ? 'suspended' : 'ready');
      if (this.step() === 2) {
        await this.loadVehicles();
      }
    } catch {
      if (generation === this.accountGeneration) {
        this.loadState.set('error');
      }
    }
  }

  // La lista de vehículos, al llegar al paso 2. Si falla, la pantalla da un
  // aviso con «Reintentar» en vez de quedarse cargando
  async loadVehicles(): Promise<void> {
    const generation = this.accountGeneration;
    if (
      this.loadingVehiclesGeneration === generation ||
      this.vehiclesState() === 'ready' ||
      !this.auth.hasProfile('driver')
    ) {
      if (!this.auth.hasProfile('driver')) {
        this.vehicles.set([]);
        this.vehiclesState.set('ready');
      }
      return;
    }
    this.loadingVehiclesGeneration = generation;
    this.vehiclesState.set('loading');
    try {
      const vehicles = await this.driver.listVehicles();
      if (generation === this.accountGeneration) {
        this.vehicles.set(vehicles);
        this.vehiclesState.set('ready');
      }
    } catch {
      if (generation === this.accountGeneration) {
        this.vehiclesState.set('error');
      }
    } finally {
      if (this.loadingVehiclesGeneration === generation) {
        this.loadingVehiclesGeneration = null;
      }
    }
  }

  // Al paso indicado (1 deja la URL limpia); llegar a él lo deja accesible
  // (también con «Adelante» del navegador). La lista de vehículos se pide al
  // llegar al paso 2, que es el único que la necesita
  goToStep(step: number, { replaceUrl = false } = {}): Promise<boolean> {
    this.furthestStep.update((furthest) => Math.max(furthest, step));
    if (step === 2) {
      void this.loadVehicles();
    }
    return this.router.navigate([], {
      queryParams: { step: step > 1 ? step : null },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  // El botón de cada paso envía el formulario: «Siguiente» (sin trayecto, lo
  // marca en rojo), «Revisar detalle» y, en el último, «Publicar viaje»
  async handleSubmit(): Promise<void> {
    const step = this.step();
    if (step === 3) {
      await this.handlePublish();
      return;
    }
    const { place, parking } = this.tripForm.controls;
    if (step === 1 && (place.invalid || parking.invalid)) {
      place.markAsTouched();
      return;
    }
    if (step === 1 && (this.isDepartureTooSoon() || this.isMissingStops())) {
      return;
    }
    await this.goToStep(step + 1);
  }

  // «Seat Ibiza · 1234BCD», o solo la matrícula si no tiene modelo
  protected vehicleLabel(vehicle: Vehicle): string {
    return `${vehicleDisplayName(vehicle)} · ${this.vehicleColors.label(vehicle.color)} · ${vehicle.plate}`;
  }

  // «0,7»: con coma decimal, en español
  protected formatDecimal(value: number): string {
    return value.toLocaleString('es-ES');
  }

  private async handlePublish(): Promise<void> {
    const { place, ...offer } = this.tripForm.getRawValue();
    const parking = this.selectedParking();
    if (
      this.tripForm.invalid ||
      !place ||
      !parking ||
      this.needsDeclaration() ||
      this.isDepartureTooSoon() ||
      this.isMissingStops()
    ) {
      this.tripForm.markAllAsTouched();
      return;
    }
    await this.save(async () => {
      if (!this.hasDeclared()) {
        await this.driver.acceptDeclaration();
        this.hasDeclared.set(true);
      }
      const request = toPublishTripRequest(place, parking, offer);
      const trip = await withDeclarations(
        { driver: this.driver, modalController: this.modalController },
        request.vehicleId,
        () => this.driver.publishTrip(request),
      );
      this.published.set(trip);
      void this.celebration.celebrate().catch(() => undefined);
      void this.toast.showSuccess('Viaje publicado.');
      void this.permissionPrompts.offerPush('publish').catch(() => undefined);
    });
  }

  // Otro viaje: mismo vehículo y trayecto, nueva hora, desde el primer paso
  async handlePublishAnother(): Promise<void> {
    this.published.set(null);
    this.tripForm.patchValue(getDefaultArrival());
    await this.goToStep(1);
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
