import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonIcon, IonSelect, IonSelectOption, ModalController } from '@ionic/angular';
import { closeOutline, locationOutline, mapOutline, navigateOutline } from 'ionicons/icons';
import { merge } from 'rxjs';
import { PickupMode } from '../../../core/models/driver.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { LocationModal, LocationModalResult } from '../../matching/location-modal/location-modal';
import { PlaceField, toSearchPlace } from '../../matching/place-field/place-field';

// Sin trayecto aún, el mapa se abre en el campus
const CAMPUS_POINT: [number, number] = [-2.4045, 36.8322];

// Lo mismo que acepta la API (ALLOWED_MAX_DETOUR_M y MAX_TRIP_STOPS)
export const PICKUP_DISTANCES_M = [150, 300, 500] as const;
export const DEFAULT_PICKUP_DISTANCE_M = 300;
export const MAX_STOPS = 5;

export interface PickupModeControls {
  pickupMode: FormControl<PickupMode>;
  maxDetourM: FormControl<number>;
  stops: FormControl<SearchPlace[]>;
}

// «Cómo recoges» al publicar hacia el campus (docs/diseno-modos-recogida-y-
// vuelta.md): en el camino, apartándose de la ruta hasta los metros elegidos
// para recoger a cada pasajero en su punto, o en sus paradas (de 1 a 5
// lugares públicos de su camino, a los que los pasajeros van andando). Una
// cosa u otra
@Component({
  selector: 'app-pickup-mode-field',
  imports: [ReactiveFormsModule, IonIcon, IonSelect, IonSelectOption, PlaceField],
  templateUrl: './pickup-mode-field.html',
  styleUrl: './pickup-mode-field.scss',
})
export class PickupModeField {
  private readonly modalController = inject(ModalController);

  readonly controls = input.required<PickupModeControls>();
  // Dónde abrir el mapa para elegir una parada (la salida del conductor)
  readonly mapCenter = input<[number, number] | null>(null);

  readonly mode = signal<PickupMode>('on_route');
  readonly stops = signal<readonly SearchPlace[]>([]);
  readonly canAddStop = computed(() => this.stops().length < MAX_STOPS);

  // El buscador de la parada siguiente: al elegir una dirección se añade a
  // la lista y se vacía para la siguiente
  readonly newStop = new FormControl<SearchPlace | null>(null);

  protected readonly distances = PICKUP_DISTANCES_M;
  protected readonly maxStops = MAX_STOPS;
  protected readonly icons = {
    route: navigateOutline,
    stop: locationOutline,
    remove: closeOutline,
    map: mapOutline,
  };

  constructor() {
    effect((onCleanup) => {
      const { pickupMode, stops } = this.controls();
      const sync = (): void => {
        this.mode.set(pickupMode.value);
        this.stops.set(stops.value);
      };
      sync();
      const subscription = merge(pickupMode.valueChanges, stops.valueChanges).subscribe(sync);
      onCleanup(() => subscription.unsubscribe());
    });
    this.newStop.valueChanges.pipe(takeUntilDestroyed()).subscribe((place) => {
      if (place) {
        this.addStop(place);
      }
    });
  }

  handleMode(value: unknown): void {
    if (value === 'on_route' || value === 'stops') {
      this.controls().pickupMode.setValue(value);
    }
  }

  // Respaldo del buscador: la parada se elige moviendo el pin en el mapa (la
  // última parada, la salida o el campus) y se añade la dirección de ese punto
  async handlePickOnMap(): Promise<void> {
    const center = this.stops().at(-1)?.coordinates ?? this.mapCenter() ?? CAMPUS_POINT;
    const modal = await this.modalController.create({
      component: LocationModal,
      componentProps: { adjustPoint: center, adjustTitle: 'Elegir parada en el mapa' },
      cssClass: 'location-dialog',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<LocationModalResult>();
    if (role === 'select' && data && !Array.isArray(data) && data.isCovered) {
      this.addStop(toSearchPlace(data));
    }
  }

  removeStop(index: number): void {
    const { stops } = this.controls();
    stops.setValue(stops.value.filter((_, position) => position !== index));
  }

  // Sin repetir la misma dirección y como mucho MAX_STOPS
  private addStop(place: SearchPlace): void {
    const { stops } = this.controls();
    const isRepeated = stops.value.some(({ id }) => id === place.id);
    if (!isRepeated && stops.value.length < MAX_STOPS) {
      stops.setValue([...stops.value, place]);
    }
    this.newStop.setValue(null, { emitEvent: false });
  }
}
