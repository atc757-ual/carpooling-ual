import { TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, Input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner, IonTextarea, ModalController } from '@ionic/angular';
import { alertCircleOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { IncidentCategory } from '../../../../core/models/admin-incident.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { IncidentsService } from '../../../../core/services/incidents/incidents.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';

export const INCIDENT_MIN_LENGTH = 10;
export const INCIDENT_MAX_LENGTH = 1000;

export interface IncidentCategoryOption {
  value: IncidentCategory;
  label: string;
  // Corto, para la pastilla
  short: string;
}

// El conductor: un problema con un pasajero en vez de con el conductor
export const DRIVER_INCIDENT_CATEGORIES: readonly IncidentCategoryOption[] = [
  { value: 'technical', label: 'Problema con el vehículo o avería', short: 'Avería' },
  { value: 'passenger', label: 'Problema con un pasajero', short: 'Un pasajero' },
  { value: 'safety', label: 'Me he sentido en peligro', short: 'En peligro' },
  { value: 'other', label: 'Otro motivo', short: 'Otro motivo' },
];

export const PASSENGER_INCIDENT_CATEGORIES: readonly IncidentCategoryOption[] = [
  { value: 'technical', label: 'Problema con el vehículo o avería', short: 'Avería' },
  { value: 'driver', label: 'Problema con el conductor o convivencia', short: 'Conductor' },
  { value: 'safety', label: 'Me he sentido en peligro', short: 'En peligro' },
  { value: 'other', label: 'Otro motivo', short: 'Otro motivo' },
];

@Component({
  selector: 'app-passenger-incident-modal',
  standalone: true,
  imports: [FormsModule, IonButton, IonIcon, IonSpinner, IonTextarea, TranslocoPipe],
  templateUrl: './passenger-incident-modal.html',
  styleUrls: ['./passenger-incident-modal.scss'],
})
export class PassengerIncidentModal {
  private readonly modalController = inject(ModalController);
  private readonly incidentsService = inject(IncidentsService);

  @Input({ required: true }) tripId!: string;
  // Dentro de una tarjeta (la hoja de En curso) en vez de en su ventana:
  // avisa con reported/cancelled en lugar de cerrar la ventana
  @Input() isInline = false;
  // El conductor: al reportar se cancela el viaje (RF-23), no solo su plaza
  @Input() isDriver = false;
  // Un viaje ya realizado (hasta 7 días después): solo se reporta, sin
  // bajarse ni cancelar nada
  @Input() isAfterTrip = false;
  readonly reported = output<void>();
  readonly cancelled = output<void>();

  get categories(): readonly IncidentCategoryOption[] {
    return this.isDriver ? DRIVER_INCIDENT_CATEGORIES : PASSENGER_INCIDENT_CATEGORIES;
  }
  get submitLabel(): string {
    if (this.isAfterTrip) {
      return 'Enviar reporte';
    }
    return this.isDriver
      ? 'Cancelar el viaje y registrar incidencia'
      : 'Bajarme y registrar incidencia';
  }
  readonly selectedCategory = signal<IncidentCategory>('technical');
  readonly description = signal('');
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  protected readonly alertIcon = alertCircleOutline;
  protected readonly reviewIcon = shieldCheckmarkOutline;
  protected readonly minLength = INCIDENT_MIN_LENGTH;
  protected readonly maxLength = INCIDENT_MAX_LENGTH;

  readonly descLength = computed(() => this.description().trim().length);
  readonly isFormValid = computed(
    () => this.descLength() >= INCIDENT_MIN_LENGTH && this.descLength() <= INCIDENT_MAX_LENGTH,
  );

  handleDescriptionInput(event: CustomEvent<{ value?: string | null }>): void {
    this.description.set(event.detail.value ?? '');
    this.errorMessage.set(null);
  }

  async handleConfirm(): Promise<void> {
    if (!this.isFormValid() || this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      const payload = {
        category: this.selectedCategory(),
        description: this.description().trim(),
      };
      await (this.isAfterTrip
        ? this.incidentsService.reportAfterTrip(this.tripId, payload)
        : this.incidentsService.reportTripIncident(this.tripId, payload));
      if (this.isInline) {
        this.reported.emit();
      } else {
        await this.modalController.dismiss({ reported: true }, 'confirm');
      }
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleCancel(): Promise<void> {
    if (this.isInline) {
      this.cancelled.emit();
      return;
    }
    await this.modalController.dismiss(null, 'cancel');
  }
}
