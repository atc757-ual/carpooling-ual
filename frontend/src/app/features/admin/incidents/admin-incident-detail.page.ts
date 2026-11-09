import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonCard,
  IonIcon,
  IonSkeletonText,
  ModalController,
} from '@ionic/angular';
import {
  carOutline,
  checkmarkDoneOutline,
  documentTextOutline,
  ellipseOutline,
  locationOutline,
  peopleOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncident } from '../../../core/models/admin-incident.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { confirmWithReason } from '../../../shared/components/modals/reason-confirm-modal/reason-confirm-modal';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { incidentDetailView, reviewStateOf } from './admin-incident-labels';

const INCIDENTS_PATH = '/admin/incidents';
const RESOLUTION_MAX_LENGTH = 1000;

// Pide la resolución y revisa la incidencia; dice si se hizo
export function reviewWithResolution(
  modalController: ModalController,
  incidents: AdminIncidentsService,
  incident: AdminIncident,
): Promise<boolean> {
  return confirmWithReason(modalController, {
    header: '¿Marcar como atendida?',
    message: 'Es definitivo: la resolución queda junto al informe original.',
    confirmText: 'Marcar atendida',
    fieldLabel: 'Resolución',
    maxLength: RESOLUTION_MAX_LENGTH,
    action: async (resolution) => {
      await incidents.review(incident.id, resolution);
    },
  });
}

// Detalle de una incidencia en el panel (CU-12): el informe, el viaje y las
// personas implicadas (con enlace a su ficha) y la revisión: empezarla,
// dejarla o atenderla con la resolución (registrada → en revisión → atendida)
@Component({
  selector: 'app-admin-incident-detail-page',
  imports: [
    HeadingContent,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonIcon,
    IonSkeletonText,
    RouterLink,
  ],
  templateUrl: './admin-incident-detail.page.html',
  styleUrl: './admin-incident-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminIncidentDetailPage {
  private readonly incidents = inject(AdminIncidentsService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  // Parámetro de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  readonly detail = resource({
    params: () => this.id(),
    loader: ({ params }) => this.incidents.get(params),
  });

  readonly incident = computed(() => (this.detail.hasValue() ? this.detail.value() : null));
  readonly view = computed(() => {
    const incident = this.incident();
    return incident ? incidentDetailView(incident) : null;
  });
  // Qué puede hacer este administrador con la revisión
  readonly reviewState = computed(() => {
    const incident = this.incident();
    return incident ? reviewStateOf(incident, this.auth.currentUser()?.id) : null;
  });
  readonly isBusy = signal(false);
  readonly error = computed(() => {
    const error = this.detail.error();
    return error ? ApiError.fromHttpError(error) : null;
  });
  readonly isNotFound = computed(() => this.error()?.code === 'INCIDENT_NOT_FOUND');
  readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? getErrorMessage(error) : null;
  });

  protected readonly icons = {
    report: documentTextOutline,
    review: checkmarkDoneOutline,
    trip: carOutline,
    origin: ellipseOutline,
    destination: locationOutline,
    people: peopleOutline,
  };
  protected readonly incidentsPath = INCIDENTS_PATH;

  // Volver a la lista con sus filtros (si se llegó desde ella), desde la
  // cabecera móvil o desde la ruta (que lleva el enlace, pero no lo sigue)
  async handleBack(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    await this.router.navigateByUrl(INCIDENTS_PATH);
  }

  async handleStartReview(): Promise<void> {
    await this.changeReview(
      (id) => this.incidents.startReview(id),
      'Has empezado a revisar la incidencia.',
    );
  }

  async handleReleaseReview(): Promise<void> {
    await this.changeReview(
      (id) => this.incidents.releaseReview(id),
      'Has dejado de revisar la incidencia.',
    );
  }

  async handleReview(): Promise<void> {
    const incident = this.incident();
    if (incident && (await reviewWithResolution(this.modalController, this.incidents, incident))) {
      void this.toast.showSuccess('Incidencia atendida.');
      this.detail.reload();
    }
  }

  // Empezar o dejar la revisión: un botón a la vez y, si falla (p. ej. otro
  // administrador la cogió antes), el motivo y la incidencia al día
  private async changeReview(
    action: (incidentId: string) => Promise<unknown>,
    success: string,
  ): Promise<void> {
    const incident = this.incident();
    if (!incident || this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    try {
      await action(incident.id);
      void this.toast.showSuccess(success);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isBusy.set(false);
      this.detail.reload();
    }
  }

  handleRetry(): void {
    this.detail.reload();
  }
}
