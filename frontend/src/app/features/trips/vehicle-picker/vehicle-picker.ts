import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonIcon, ModalController } from '@ionic/angular';
import { addOutline, carOutline } from 'ionicons/icons';
import { startWith, switchMap } from 'rxjs';
import { Vehicle } from '../../../core/models/driver.model';
import { PreferencesPlugin } from '../../../core/plugins/preferences-plugin';
import { AuthService } from '../../../core/services/auth/auth.service';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { VehicleCard } from '../../../shared/components/ui/vehicle-card/vehicle-card';
import { VehicleModal } from '../vehicle-modal/vehicle-modal';

// Vehículos activos que puede tener un conductor (VEHICLE_LIMIT_REACHED)
export const MAX_VEHICLES = 3;
// El vehículo predeterminado, en este dispositivo
export const DEFAULT_VEHICLE_KEY = 'publish.default-vehicle';

export interface VehiclePickerControls {
  vehicleId: FormControl<string>;
  seats: FormControl<number>;
}

// Paso «Vehículo» de Publicar: una tarjeta por vehículo (se elige pulsándola;
// editarlo o eliminarlo se hace en Mi perfil), «Añadir vehículo» arriba a la
// derecha (hasta 3; sin ninguno, la tarjeta «Registrar vehículo») y, debajo,
// cuántos asientos tiene el elegido y las plazas que se ofrecen. Al entrar
// sale elegido el predeterminado (el último elegido o registrado en este
// dispositivo) o, sin él, el primero. A la derecha de las plazas, lo que se
// proyecte (el botón para seguir)
@Component({
  selector: 'app-vehicle-picker',
  imports: [ReactiveFormsModule, IonIcon, SeatStepper, VehicleCard],
  templateUrl: './vehicle-picker.html',
  styleUrl: './vehicle-picker.scss',
})
export class VehiclePicker implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly auth = inject(AuthService);

  readonly vehicles = model.required<readonly Vehicle[]>();
  // Los controles del formulario de Publicar (form.controls)
  readonly controls = input.required<VehiclePickerControls>();

  // El predeterminado guardado; undefined mientras se lee
  private readonly defaultId = signal<string | null | undefined>(undefined);

  // Los controles no son signals: el vehículo elegido y las plazas
  readonly selectedId = toSignal(
    toObservable(this.controls).pipe(
      switchMap(({ vehicleId }) => vehicleId.valueChanges.pipe(startWith(vehicleId.value))),
    ),
    { initialValue: '' },
  );
  readonly seats = toSignal(
    toObservable(this.controls).pipe(
      switchMap(({ seats }) => seats.valueChanges.pipe(startWith(seats.value))),
    ),
    { initialValue: 1 },
  );

  readonly selectedVehicle = computed(() =>
    this.vehicles().find(({ id }) => id === this.selectedId()),
  );
  // Plazas ofrecidas: de 1 a las de pasajeros del vehículo elegido
  readonly maxSeats = computed(() => this.selectedVehicle()?.capacity ?? 1);
  readonly canAdd = computed(() => this.vehicles().length < MAX_VEHICLES);

  protected readonly icons = {
    add: addOutline,
    car: carOutline,
  };

  constructor() {
    // Sin vehículo elegido (o si ya no está): el predeterminado o el primero
    effect(() => {
      const vehicles = this.vehicles();
      const defaultId = this.defaultId();
      if (defaultId === undefined) {
        return;
      }
      untracked(() => {
        const control = this.controls().vehicleId;
        if (vehicles.some(({ id }) => id === control.value)) {
          return;
        }
        const preferred = vehicles.find(({ id }) => id === defaultId) ?? vehicles[0];
        control.setValue(preferred?.id ?? '');
      });
    });
    // Al cambiar de vehículo, las plazas no pasan de las suyas
    effect(() => {
      const max = this.maxSeats();
      untracked(() => {
        const control = this.controls().seats;
        control.setValidators([Validators.required, Validators.min(1), Validators.max(max)]);
        if (Number(control.value) > max) {
          control.setValue(max);
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    });
  }

  ngOnInit(): void {
    void this.loadDefault();
  }

  // Elegir un vehículo lo deja como predeterminado
  handleSelect(vehicle: Vehicle): void {
    this.controls().vehicleId.setValue(vehicle.id);
    void this.preferences.set(DEFAULT_VEHICLE_KEY, vehicle.id).catch(() => undefined);
  }

  // Registrar otro: al guardarlo queda elegido y como predeterminado. El
  // primero de todos hace conductor (el backend activa el perfil): el token
  // nuevo lo lleva
  async handleAdd(): Promise<void> {
    const { data, role } = await this.openModal(null);
    if (role !== 'saved' || !data) {
      return;
    }
    if (!this.auth.hasProfile('driver')) {
      await this.auth.refreshAccessToken().catch(() => undefined);
    }
    this.vehicles.set([...this.vehicles(), data]);
    this.handleSelect(data);
  }

  // El predeterminado de este dispositivo (null si no hay o no se puede leer)
  private async loadDefault(): Promise<void> {
    this.defaultId.set(await this.preferences.get(DEFAULT_VEHICLE_KEY).catch(() => null));
  }

  private async openModal(vehicle: Vehicle | null) {
    const modal = await this.modalController.create({
      component: VehicleModal,
      componentProps: { vehicle },
      cssClass: 'info-dialog',
    });
    await modal.present();
    return modal.onWillDismiss<Vehicle>();
  }
}
