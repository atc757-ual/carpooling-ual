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
} from '@ionic/angular';
import { carOutline, checkmarkCircleOutline, leafOutline } from 'ionicons/icons';
import { map } from 'rxjs';
import { ApiError } from '../../../core/models/api-error.model';
import { PublishedTrip, Vehicle } from '../../../core/models/driver.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { CelebrationService } from '../../../core/services/ui/celebration.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { DatetimeField } from '../../../shared/components/ui/datetime-field/datetime-field';
import { RouteTimeline } from '../../../shared/components/ui/route-timeline/route-timeline';
import { FaqCard } from '../../../shared/components/ui/faq-card/faq-card';
import { StepIndicator } from '../../../shared/components/ui/step-indicator/step-indicator';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { RouteFields } from '../../matching/route-fields/route-fields';

import { getDefaultTime } from '../../matching/trip-search-form/trip-search-form';
import { DeclarationField } from '../declaration-field/declaration-field';
import { PublishNextSteps } from '../publish-next-steps/publish-next-steps';
import { VehiclePicker } from '../vehicle-picker/vehicle-picker';
import { PUBLISH_FAQS } from './publish-help';
import {
  buildStops,
  estimateDriverImpact,
  formatDateLabel,
  toPublishTripRequest,
} from './publish-trip.utils';
import { toIsoDate } from '../../../shared/utils/date.util';
import { vehicleColorLabel, vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';

export const DETOURS = [5, 10, 15, 20] as const;
const DEFAULT_DETOUR = 10;
// La salida por defecto, dentro de una hora: así queda margen para cancelar
// sin penalización (hasta 30 minutos antes)
const PUBLISH_LEAD_MINUTES = 60;
export const STEPS = ['Trayecto', 'Vehículo', 'Revisión', 'Publicado'] as const;
const PUBLISHED_STEP = STEPS.length;

type LoadState = 'loading' | 'error' | 'ready';

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
    FaqCard,
    RouteFields,
    RouteTimeline,
    StepIndicator,
    PublishNextSteps,
    VehiclePicker,
  ],
  templateUrl: './publish-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './publish-trip.page.scss'],
})
export class PublishTripPage implements OnInit {
  private readonly driver = inject(DriverService);
  private readonly auth = inject(AuthService);
  private readonly places = inject(PlacesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly celebration = inject(CelebrationService);

  readonly loadState = signal<LoadState>('loading');
  // Los vehículos se piden al llegar al paso 2, no antes: el 1 no los necesita
  readonly vehiclesState = signal<LoadState>('loading');
  readonly vehicles = signal<readonly Vehicle[]>([]);
  readonly hasDeclared = signal(false);
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
    date: [toIsoDate(new Date())],
    time: [getDefaultTime(new Date(), PUBLISH_LEAD_MINUTES)],
    vehicleId: ['', Validators.required],
    seats: [1, [Validators.required, Validators.min(1)]],
    maxDetourMin: [DEFAULT_DETOUR],
    declaration: [false],
  });

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

  // Paradas del viaje, con la llegada aproximada: para la revisión y al
  // publicar
  readonly stops = computed(() => {
    const { place, isToCampus = true, time = '' } = this.tripValue();
    const parking = this.selectedParking();
    return place && parking ? buildStops(place, parking, { isToCampus, time }) : null;
  });

  readonly dateLabel = computed(() => formatDateLabel(this.tripValue().date ?? ''));

  // «Volver a Trayecto»: el paso anterior, por su nombre (al publicar, no hay)
  readonly previousStep = computed(() => {
    const step = this.step();
    return step > 1 && step < PUBLISHED_STEP ? { number: step - 1, name: STEPS[step - 2] } : null;
  });

  constructor() {
    effect(() => {
      const userId = this.auth.currentUser()?.id ?? null;
      if (userId === this.accountId) {
        return;
      }
      this.accountId = userId;
      this.accountGeneration += 1;
      this.loadingVehiclesGeneration = null;
      this.vehicles.set([]);
      this.tripForm.reset({
        place: null,
        parking: '',
        isToCampus: true,
        date: toIsoDate(new Date()),
        time: getDefaultTime(new Date(), PUBLISH_LEAD_MINUTES),
        vehicleId: '',
        seats: 1,
        maxDetourMin: DEFAULT_DETOUR,
        declaration: false,
      });
      this.furthestStep.set(1);
      this.hasDeclared.set(false);
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
      const [status] = await Promise.all([this.driver.getStatus(), this.places.loadParkings()]);
      if (generation !== this.accountGeneration) {
        return;
      }
      this.hasDeclared.set(status.hasLicenseDeclared);
      this.loadState.set('ready');
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
    await this.goToStep(step + 1);
  }

  // «Seat Ibiza · 1234BCD», o solo la matrícula si no tiene modelo
  protected vehicleLabel(vehicle: Vehicle): string {
    return `${vehicleDisplayName(vehicle)} · ${vehicleColorLabel(vehicle.color)} · ${vehicle.plate}`;
  }

  // «0,7»: con coma decimal, en español
  protected formatDecimal(value: number): string {
    return value.toLocaleString('es-ES');
  }

  private async handlePublish(): Promise<void> {
    const { place, ...offer } = this.tripForm.getRawValue();
    const parking = this.selectedParking();
    if (this.tripForm.invalid || !place || !parking || this.needsDeclaration()) {
      this.tripForm.markAllAsTouched();
      return;
    }
    await this.save(async () => {
      if (!this.hasDeclared()) {
        await this.driver.acceptDeclaration();
        this.hasDeclared.set(true);
      }
      const trip = await this.driver.publishTrip(toPublishTripRequest(place, parking, offer));
      this.published.set(trip);
      void this.celebration.celebrate().catch(() => undefined);
      void this.toast.showSuccess('Viaje publicado.');
    });
  }

  // Otro viaje: mismo vehículo y trayecto, nueva hora, desde el primer paso
  async handlePublishAnother(): Promise<void> {
    this.published.set(null);
    this.tripForm.patchValue({ time: getDefaultTime(new Date(), PUBLISH_LEAD_MINUTES) });
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
