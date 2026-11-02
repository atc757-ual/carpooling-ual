import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonSkeletonText, ModalController } from '@ionic/angular';
import { arrowBackOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  CATEGORY_LABELS,
  formatDateTime,
  incidentRoute,
  severityOf,
} from './admin-incident-labels';
import { reviewWithResolution } from './admin-incidents.page';

const INCIDENTS_PATH = '/admin/incidents';

// Detalle de una incidencia en el panel (CU-12): el informe, el viaje y las
// personas implicadas (con enlace a su ficha) y la revisión con su resolución
@Component({
  selector: 'app-admin-incident-detail-page',
  imports: [IonButton, IonIcon, IonSkeletonText, RouterLink],
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

  // Parámetro de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  readonly detail = resource({
    params: () => this.id(),
    loader: ({ params }) => this.incidents.get(params),
  });

  readonly incident = computed(() => (this.detail.hasValue() ? this.detail.value() : null));
  readonly view = computed(() => {
    const incident = this.incident();
    return incident
      ? {
          title: CATEGORY_LABELS[incident.category],
          severity: severityOf(incident.category),
          reportedAt: formatDateTime(incident.reportedAt),
          route: incidentRoute(incident),
          departureAt: incident.trip.departureAt ? formatDateTime(incident.trip.departureAt) : null,
          reviewedAt: incident.review ? formatDateTime(incident.review.reviewedAt) : null,
        }
      : null;
  });
  readonly error = computed(() => {
    const error = this.detail.error();
    return error ? ApiError.fromHttpError(error) : null;
  });
  readonly isNotFound = computed(() => this.error()?.code === 'INCIDENT_NOT_FOUND');
  readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? getErrorMessage(error) : null;
  });

  protected readonly backIcon = arrowBackOutline;
  protected readonly incidentsPath = INCIDENTS_PATH;

  // Volver a la lista con sus filtros (si se llegó desde ella)
  async handleBack(): Promise<void> {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    await this.router.navigateByUrl(INCIDENTS_PATH);
  }

  async handleReview(): Promise<void> {
    const incident = this.incident();
    if (incident && (await reviewWithResolution(this.modalController, this.incidents, incident))) {
      void this.toast.showSuccess('Incidencia revisada.');
      this.detail.reload();
    }
  }

  handleRetry(): void {
    this.detail.reload();
  }
}
