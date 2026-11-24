import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { IonButton, IonCheckbox, ModalController } from '@ionic/angular';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { UsualTrip } from '../../../../core/models/usual-trip.model';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { ModalHeader } from '../../../../shared/components/modals/modal-header/modal-header';
import { DatetimeField } from '../../../../shared/components/ui/datetime-field/datetime-field';
import { WeekdayPicker } from '../../../../shared/components/ui/weekday-picker/weekday-picker';
import { isReturnBeforeArrival } from '../../../trips/return-trip-field/return-trip';
import { UsualTripService } from '../usual-trip.service';

// La vuelta que se propone si aún no tiene: 6 h después de llegar
const DEFAULT_RETURN_TIME = '14:00';

// Guardar o editar «Mi trayecto habitual»: el sitio y el parking vienen de la
// búsqueda; aquí se eligen los días, la hora de llegada y, si se quiere, la
// de la vuelta. Al editar, también se puede borrar
@Component({
  selector: 'app-usual-trip-modal',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonCheckbox,
    ModalHeader,
    DatetimeField,
    WeekdayPicker,
    TranslocoPipe,
  ],
  templateUrl: './usual-trip-modal.html',
  styleUrl: './usual-trip-modal.scss',
})
export class UsualTripModal implements OnInit {
  private readonly usualTrips = inject(UsualTripService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  // Lo pasa ModalController (componentProps): el trayecto de partida y si
  // es nuevo (sin «Borrar»)
  @Input({ required: true }) trip!: UsualTrip;
  @Input() isNew = true;

  readonly form = inject(NonNullableFormBuilder).group({
    arrivalTime: [''],
    hasReturn: [false],
    returnTime: [DEFAULT_RETURN_TIME],
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.value });
  readonly weekdays = signal<number[]>([]);
  readonly hasReturn = computed(() => Boolean(this.value().hasReturn));
  readonly isReturnTooEarly = computed(
    () =>
      this.hasReturn() &&
      isReturnBeforeArrival(this.value().arrivalTime ?? '', this.value().returnTime ?? ''),
  );
  readonly canSave = computed(() => this.weekdays().length > 0 && !this.isReturnTooEarly());

  ngOnInit(): void {
    this.weekdays.set([...this.trip.weekdays]);
    this.form.setValue({
      arrivalTime: this.trip.arrivalTime,
      hasReturn: this.trip.returnTime !== null,
      returnTime: this.trip.returnTime ?? DEFAULT_RETURN_TIME,
    });
  }

  async handleSave(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    const { arrivalTime, hasReturn, returnTime } = this.form.getRawValue();
    await this.usualTrips.save({
      ...this.trip,
      weekdays: this.weekdays(),
      arrivalTime,
      returnTime: hasReturn ? returnTime : null,
    });
    void this.toast.showSuccess(translate('usualTrip.saved'));
    await this.modalController.dismiss(null, 'saved');
  }

  async handleRemove(): Promise<void> {
    await this.usualTrips.remove();
    void this.toast.showSuccess(translate('usualTrip.removed'));
    await this.modalController.dismiss(null, 'removed');
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }
}
