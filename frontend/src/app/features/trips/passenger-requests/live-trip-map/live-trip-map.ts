import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { locateOutline } from 'ionicons/icons';
import { ApiError } from '../../../../core/models/api-error.model';
import { GeoPoint } from '../../../../core/models/place.model';
import { TripPosition } from '../../../../core/models/trip-position.model';
import {
  CurrentLocation,
  LocationService,
} from '../../../../core/services/location/location.service';
import { TrackingService } from '../../../../core/services/tracking/tracking.service';
import { areTogether, distanceMeters, estimatePickupMinutes, inAbout } from './live-trip-map.utils';
import { LIVE_TRIP_MAP_RENDERER_FACTORY, LOAD_LEAFLET } from './live-trip-map-runtime';
import type { LeafletModule, LiveTripMapRendererPort } from './live-trip-map-runtime';

const POSITION_POLL_MS = 10_000;
const CLOCK_UPDATE_MS = 1_000;
const STALE_POSITION_SECONDS = 60;

// Minutos que faltan hasta la recogida y hasta el destino según la última
// posición del coche (null si aún no se sabe), y si el pasajero ya va dentro
export interface LiveTripStatus {
  pickupMinutes: number | null;
  destinationMinutes: number | null;
  // Metros en línea recta del coche al destino (si se le pasa el destino)
  destinationMeters: number | null;
  isTogether: boolean;
  // Sin posición reciente (más de 1 min)
  isStale: boolean;
}

@Component({
  selector: 'app-live-trip-map',
  imports: [IonIcon],
  templateUrl: './live-trip-map.html',
  styleUrl: './live-trip-map.scss',
})
export class LiveTripMap {
  private readonly tracking = inject(TrackingService);
  private readonly location = inject(LocationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadLeaflet = inject(LOAD_LEAFLET);
  private readonly createRenderer = inject(LIVE_TRIP_MAP_RENDERER_FACTORY);

  readonly tripId = input.required<string>();
  readonly pickupLocation = input<GeoPoint | null>(null);
  readonly pickupName = input('Punto de recogida');
  readonly initialCenter = input.required<GeoPoint>();
  readonly active = input(true);
  // Quién mira: el pasajero ve el coche, su recogida y su ubicación; el
  // conductor, su propia posición (la que ven sus pasajeros) y su siguiente
  // recogida, sin su ubicación aparte (sería el mismo punto que el coche)
  readonly viewer = input<'passenger' | 'driver'>('passenger');
  // El nombre del conductor, para el pasajero («Lucía llega en…»)
  readonly driverName = input('El conductor');
  // El destino del viaje, para saber cuánto le falta al coche (opcional)
  readonly destination = input<GeoPoint | null>(null);
  // Lo que tapa por abajo la hoja de detalles del móvil (px): el encuadre
  // deja ese hueco para que el coche y la recogida queden a la vista
  readonly bottomInset = input(0);

  readonly isDriver = computed(() => this.viewer() === 'driver');
  readonly latestPosition = signal<TripPosition | null>(null);
  readonly userLocation = signal<CurrentLocation | null>(null);
  readonly locationResolved = signal(false);
  readonly refreshFailed = signal(false);
  readonly now = signal(Date.now());
  readonly ageSeconds = computed(() => {
    const recordedAt = this.latestPosition()?.recordedAt;
    const timestamp = recordedAt ? Date.parse(recordedAt) : Number.NaN;
    return Number.isFinite(timestamp)
      ? Math.max(0, Math.floor((this.now() - timestamp) / 1000))
      : 0;
  });
  readonly isStale = computed(
    () => this.latestPosition() !== null && this.ageSeconds() > STALE_POSITION_SECONDS,
  );
  readonly isTogether = computed(() => {
    const position = this.latestPosition();
    const user = this.userLocation();
    return (
      position !== null &&
      user !== null &&
      areTogether(position.position.coordinates, user.coordinates)
    );
  });
  readonly estimatedPickupMinutes = computed(() => {
    const position = this.latestPosition();
    const pickup = this.pickupLocation();
    return position && pickup && !this.isTogether()
      ? estimatePickupMinutes(position.position.coordinates, pickup.coordinates)
      : null;
  });
  private readonly destinationMeters = computed(() => {
    const position = this.latestPosition();
    const destination = this.destination();
    return position && destination
      ? distanceMeters(position.position.coordinates, destination.coordinates)
      : null;
  });

  // Lo que se sabe en directo, para quien lo pinta fuera del mapa (la
  // tarjeta «En directo» de las pantallas En curso)
  readonly liveStatus = computed<LiveTripStatus>(() => ({
    pickupMinutes: this.estimatedPickupMinutes(),
    destinationMinutes: this.latestPosition()?.remainingMin ?? null,
    destinationMeters: this.destinationMeters(),
    isTogether: this.isTogether(),
    isStale: this.isStale(),
  }));
  readonly statusChange = output<LiveTripStatus>();

  readonly mapLabel = computed(() =>
    this.isDriver()
      ? `Tu posición y ${this.pickupName()}`
      : `Posición actual del coche y ${this.pickupName()}`,
  );

  protected readonly centerIcon = locateOutline;
  protected readonly inAbout = inAbout;
  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private readonly documentVisible = signal(
    typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  private readonly mapReady = signal(false);
  private renderer: LiveTripMapRendererPort | null = null;
  private mapInitializing = false;
  private destroyed = false;

  constructor() {
    effect(() => this.statusChange.emit(this.liveStatus()));

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.destroyRef.onDestroy(() => this.destroyMap());
    this.createPollingEffect();
    this.createMapEffect();
    effect(() => this.renderer?.setBottomInset(this.bottomInset()));
  }

  protected centerMap(): void {
    this.renderer?.center(
      this.latestPosition(),
      this.userLocation(),
      this.pickupLocation(),
      this.initialCenter(),
    );
  }

  private createPollingEffect(): void {
    effect((onCleanup) => {
      const tripId = this.tripId();
      if (!this.active() || !this.documentVisible()) return;
      let stopped = false;
      let requestInFlight = false;
      const refresh = async () => {
        if (requestInFlight || stopped) return;
        requestInFlight = true;
        const [positionResult, locationResult] = await Promise.allSettled([
          this.tracking.getLatest(tripId),
          this.readLocalLocation(),
        ]);
        if (!stopped) {
          this.applyPositionResult(positionResult);
          this.userLocation.set(
            locationResult.status === 'fulfilled' ? locationResult.value : null,
          );
          this.locationResolved.set(true);
          this.now.set(Date.now());
        }
        requestInFlight = false;
      };
      void refresh();
      const pollTimer = window.setInterval(() => void refresh(), POSITION_POLL_MS);
      const clockTimer = window.setInterval(() => this.now.set(Date.now()), CLOCK_UPDATE_MS);
      onCleanup(() => {
        stopped = true;
        window.clearInterval(pollTimer);
        window.clearInterval(clockTimer);
      });
    });
  }

  private createMapEffect(): void {
    effect(() => {
      const element = this.mapElement()?.nativeElement;
      const position = this.latestPosition();
      const user = this.userLocation();
      const pickup = this.pickupLocation();
      const ready = this.mapReady();
      if (!element) return;
      if (!ready) {
        void this.initializeMap(element, pickup ?? this.initialCenter());
        return;
      }
      this.renderer?.render(
        position,
        user,
        pickup,
        this.pickupName(),
        this.initialCenter(),
        this.locationResolved(),
      );
    });
  }

  private readonly handleVisibilityChange = (): void => {
    this.documentVisible.set(document.visibilityState === 'visible');
  };

  private async readLocalLocation(): Promise<CurrentLocation | null> {
    if (this.isDriver() || (await this.location.checkPermission()) !== 'granted') return null;
    return this.location.getCurrentLocation();
  }

  private applyPositionResult(result: PromiseSettledResult<TripPosition>): void {
    if (result.status === 'fulfilled') {
      this.latestPosition.set(result.value);
      this.refreshFailed.set(false);
    } else if (result.reason instanceof ApiError && result.reason.code === 'POSITION_NOT_FOUND') {
      this.refreshFailed.set(false);
    } else {
      this.refreshFailed.set(true);
    }
  }

  private async initializeMap(element: HTMLElement, center: GeoPoint): Promise<void> {
    if (this.mapInitializing || this.destroyed) return;
    this.mapInitializing = true;
    try {
      const leafletModule: LeafletModule = await this.loadLeaflet();
      if (this.destroyed) return;
      this.renderer = this.createRenderer(leafletModule.default ?? leafletModule);
      this.renderer.setBottomInset(this.bottomInset());
      this.renderer.initialize(element, center);
      this.mapReady.set(true);
    } finally {
      this.mapInitializing = false;
    }
  }

  private destroyMap(): void {
    this.destroyed = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.renderer?.destroy();
  }
}
