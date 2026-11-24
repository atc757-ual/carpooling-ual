import {
  Component,
  computed,
  inject,
  Input,
  linkedSignal,
  OnInit,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton, IonCheckbox, IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { addOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverTrip, Vehicle } from '../../../core/models/driver.model';
import { dateTimeFormat } from '../../../core/i18n/app-locale';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { VehicleCard } from '../../../shared/components/ui/vehicle-card/vehicle-card';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { VehicleForm } from '../vehicle-form/vehicle-form';
import { MAX_VEHICLES } from '../vehicle-picker/vehicle-picker';

// remove: dar de baja un coche con viajes programados (cada viaje marcado
// pasa al coche elegido y los demás se cancelan); change: cambiar el coche de
// un solo viaje (una avería puntual)
export type VehicleTripsMode = 'remove' | 'change';

export interface VehicleTripRow {
  trip: DriverTrip;
  when: string;
  where: string;
  seats: string;
}

const WHEN = () =>
  dateTimeFormat({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

// «lun, 1 dic, 08:00 · Campus UAL · 2 plazas ocupadas»
export function vehicleTripRow(trip: DriverTrip): VehicleTripRow {
  const taken = trip.offeredSeats - trip.availableSeats;
  let seats = translate('profile.vehicleTrips.noPassengers');
  if (taken === 1) {
    seats = translate('profile.vehicleTrips.seatsTakenOne');
  } else if (taken > 1) {
    seats = translate('profile.vehicleTrips.seatsTakenOther', { count: taken });
  }
  return {
    trip,
    when: WHEN().format(new Date(trip.departureAt)),
    where: trip.destinationName ?? '',
    seats,
  };
}

// El botón dice exactamente lo que va a pasar
export function confirmLabel(kept: number, cancelled: number): string {
  if (cancelled === 0) {
    return translate('profile.vehicleTrips.keepAll');
  }
  if (kept === 0) {
    return cancelled === 1
      ? translate('profile.vehicleTrips.cancelAllOne')
      : translate('profile.vehicleTrips.cancelAllOther', { count: cancelled });
  }
  return translate('profile.vehicleTrips.keepAndCancel', { kept, cancelled });
}

// Abre la ventana y devuelve cómo se cerró: 'removed' (coche dado de baja),
// 'changed' (viaje con otro coche) o nada (sin cambios)
export async function openVehicleTripsModal(
  modalController: ModalController,
  props: { mode: VehicleTripsMode; vehicleId: string; trips: DriverTrip[] },
): Promise<string | undefined> {
  const modal = await modalController.create({
    component: VehicleTripsModal,
    cssClass: 'info-dialog',
    componentProps: props,
  });
  await modal.present();
  const { role } = await modal.onDidDismiss();
  return role;
}

// Los viajes programados de un coche: al darlo de baja, cuáles se mantienen
// con otro coche (avisando a sus pasajeros) y cuáles se cancelan; o el cambio
// de coche de un viaje. Se puede registrar otro coche sin salir
@Component({
  selector: 'app-vehicle-trips-modal',
  imports: [
    IonButton,
    IonCheckbox,
    IonIcon,
    IonSpinner,
    ModalHeader,
    TranslocoPipe,
    VehicleCard,
    VehicleForm,
  ],
  templateUrl: './vehicle-trips-modal.html',
  styleUrl: './vehicle-trips-modal.scss',
})
export class VehicleTripsModal implements OnInit {
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  // Lo pasa ModalController (componentProps), por eso son @Input clásicos
  @Input() mode: VehicleTripsMode = 'remove';
  // El coche que se da de baja, o el que lleva ahora el viaje
  @Input({ required: true }) vehicleId!: string;
  @Input({ required: true }) trips: DriverTrip[] = [];

  readonly rows = signal<VehicleTripRow[]>([]);
  // Marcados: los que se mantienen (todos, al abrir)
  readonly keptIds = signal<ReadonlySet<string>>(new Set());

  readonly vehicles = resource({ loader: () => this.driver.listVehicles() });
  // Los otros coches activos, a los que se pueden pasar
  readonly otherVehicles = computed(() =>
    (this.vehicles.value() ?? []).filter(
      ({ id, status }) => id !== this.vehicleId && status !== 'inactive',
    ),
  );
  // El coche que lleva ahora el viaje (al cambiarlo)
  readonly currentVehicle = computed(
    () => (this.vehicles.value() ?? []).find(({ id }) => id === this.vehicleId) ?? null,
  );
  readonly targetId = linkedSignal(() => this.otherVehicles()[0]?.id ?? null);
  // Cabe uno más (hasta 3 activos, contando el que se da de baja)
  readonly canRegister = computed(() => this.otherVehicles().length + 1 < MAX_VEHICLES);

  readonly kept = computed(() =>
    this.targetId() === null ? [] : this.trips.filter(({ id }) => this.keptIds().has(id)),
  );
  readonly cancelled = computed(() => {
    const kept = new Set(this.kept().map(({ id }) => id));
    return this.trips.filter(({ id }) => !kept.has(id));
  });
  readonly title = computed(() => {
    if (this.mode === 'change') {
      return translate('profile.vehicleTrips.changeTitle');
    }
    return this.trips.length === 1
      ? translate('profile.vehicleTrips.titleOne')
      : translate('profile.vehicleTrips.titleOther', { count: this.trips.length });
  });
  readonly intro = computed(() => {
    if (this.mode === 'change') {
      return this.otherVehicles().length > 0
        ? translate('profile.vehicleTrips.changeIntro')
        : translate('profile.vehicleTrips.changeNoOther');
    }
    return this.otherVehicles().length > 0
      ? translate('profile.vehicleTrips.intro')
      : translate('profile.vehicleTrips.introNoOther');
  });
  readonly confirmText = computed(() =>
    this.mode === 'change'
      ? translate('profile.vehicleTrips.changeConfirm')
      : confirmLabel(this.kept().length, this.cancelled().length),
  );
  // Cambiar de coche necesita otro coche; dar de baja, nunca se bloquea
  readonly canConfirm = computed(
    () => !this.isSaving() && (this.mode === 'remove' || this.targetId() !== null),
  );
  readonly isSaving = signal(false);
  // El paso de registrar otro coche, con el formulario en lugar de la lista
  readonly isRegistering = signal(false);
  // El formulario: dice si se está leyendo la declaración (sin la flecha)
  protected readonly form = viewChild(VehicleForm);

  protected readonly addIcon = addOutline;

  ngOnInit(): void {
    this.rows.set(this.trips.map(vehicleTripRow));
    this.keptIds.set(new Set(this.trips.map(({ id }) => id)));
  }

  handleToggle(tripId: string, isKept: boolean): void {
    const kept = new Set(this.keptIds());
    if (isKept) {
      kept.add(tripId);
    } else {
      kept.delete(tripId);
    }
    this.keptIds.set(kept);
  }

  handleTarget(vehicle: Vehicle): void {
    this.targetId.set(vehicle.id);
  }

  // Registrar otro coche sin salir: al guardarlo, queda elegido
  // (un paso dentro de esta misma ventana, no otra encima)
  handleRegister(): void {
    this.isRegistering.set(true);
  }

  handleRegistered(vehicle: Vehicle): void {
    void this.toast.showSuccess(translate('screens.vehicleModal.vehiculoRegistrado'));
    this.isRegistering.set(false);
    this.vehicles.reload();
    this.targetId.set(vehicle.id);
  }

  handleBack(): void {
    this.isRegistering.set(false);
  }

  async handleConfirm(): Promise<void> {
    if (!this.canConfirm()) {
      return;
    }
    this.isSaving.set(true);
    try {
      const role = this.mode === 'change' ? await this.changeOne() : await this.removeVehicle();
      await this.modalController.dismiss(null, role);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSaving.set(false);
    }
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  private async changeOne(): Promise<'changed'> {
    await this.driver.changeTripsVehicle(
      this.trips.map(({ id }) => id),
      this.targetId() as string,
    );
    void this.toast.showSuccess(translate('profile.vehicleTrips.changed'));
    return 'changed';
  }

  // Primero los que se mantienen (todos o ninguno), después las
  // cancelaciones, una a una, y por último la baja
  private async removeVehicle(): Promise<'removed'> {
    const target = this.targetId();
    const kept = this.kept();
    if (target !== null && kept.length > 0) {
      await this.driver.changeTripsVehicle(
        kept.map(({ id }) => id),
        target,
      );
    }
    await this.cancelled().reduce<Promise<unknown>>(
      (chain, trip) => chain.then(() => this.driver.cancelTrip(trip.id)),
      Promise.resolve(),
    );
    await this.driver.deactivateVehicle(this.vehicleId);
    void this.toast.showSuccess(translate('profile.vehicleTrips.removed'));
    return 'removed';
  }
}
