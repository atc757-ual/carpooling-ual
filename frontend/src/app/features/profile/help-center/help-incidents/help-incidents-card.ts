import { Component, inject, resource, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonItem,
  IonLabel,
  IonList,
  IonSkeletonText,
  ModalController,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import type { MyIncident } from '../../../../core/models/my-incident.model';
import {
  IncidentsService,
  MY_INCIDENTS_PAGE_SIZE,
} from '../../../../core/services/incidents/incidents.service';
import { Pagination } from '../../../../shared/components/ui/pagination/pagination';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { openHelpIncidentModal } from './help-incidents-priority';
import { incidentCategoryKey, incidentDate, MY_INCIDENT_STATUS } from './my-incident-labels';

// «Tus incidencias», en la columna de 4 de Ayuda y soporte, bajo «Escribir a
// soporte» (encima, y la columna antes de las preguntas en el móvil, si hay
// alguna activa o atendida hace poco): las que comunicó el usuario (de 5 en
// 5) con su estado; cada una abre su detalle y la respuesta del equipo en una
// ventana
@Component({
  selector: 'app-help-incidents-card',
  imports: [
    IonButton,
    IonCard,
    IonItem,
    IonLabel,
    IonList,
    IonSkeletonText,
    Pagination,
    TranslocoPipe,
  ],
  templateUrl: './help-incidents-card.html',
  styleUrl: './help-incidents-card.scss',
})
export class HelpIncidentsCard {
  private readonly incidentsService = inject(IncidentsService);
  private readonly modalController = inject(ModalController);

  readonly pageSize = MY_INCIDENTS_PAGE_SIZE;
  readonly skeletonRows = [0, 1];
  readonly offset = signal(0);

  readonly page = resource({
    params: () => this.offset(),
    loader: ({ params: offset }) => this.incidentsService.listMine(offset),
  });

  readonly statuses = MY_INCIDENT_STATUS;
  readonly categoryKey = incidentCategoryKey;
  readonly date = incidentDate;

  errorMessage(): string | null {
    const error = this.page.error();
    return error instanceof ApiError ? getErrorMessage(error) : null;
  }

  handleRetry(): void {
    this.page.reload();
  }

  handlePage(offset: number): void {
    this.offset.set(offset);
  }

  handleOpen(incident: MyIncident): Promise<void> {
    return openHelpIncidentModal(this.modalController, incident);
  }
}
