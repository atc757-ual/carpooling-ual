import { Component, inject, Input, OnInit } from '@angular/core';
import { IonIcon, IonItem, IonLabel, IonList, IonNote, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons';
import type { MyIncident } from '../../../../core/models/my-incident.model';
import { ModalHeader } from '../../../../shared/components/modals/modal-header/modal-header';
import {
  incidentCategoryKey,
  incidentDateTime,
  incidentTripLine,
  MY_INCIDENT_STATUS,
} from './my-incident-labels';

export interface IncidentMoment {
  labelKey: string;
  // null: aún no ha llegado (en gris)
  at: string | null;
}

// Registrada → en revisión → atendida, con la fecha de cada momento
export function incidentMoments({
  reportedAt,
  reviewInProgress,
  review,
}: MyIncident): IncidentMoment[] {
  return [
    { labelKey: MY_INCIDENT_STATUS.open.labelKey, at: reportedAt },
    {
      labelKey: MY_INCIDENT_STATUS.in_review.labelKey,
      at: reviewInProgress?.since ?? review?.startedAt ?? null,
    },
    { labelKey: MY_INCIDENT_STATUS.reviewed.labelKey, at: review?.reviewedAt ?? null },
  ];
}

// El detalle de una incidencia que comunicó el usuario: el estado, el motivo,
// el viaje, lo que contó, los momentos de la revisión y, al terminar, la
// respuesta del equipo (sin el nombre del administrador)
@Component({
  selector: 'app-help-incident-modal',
  imports: [IonIcon, IonItem, IonLabel, IonList, IonNote, ModalHeader, TranslocoPipe],
  templateUrl: './help-incident-modal.html',
  styleUrl: './help-incident-modal.scss',
})
export class HelpIncidentModal implements OnInit {
  private readonly modalController = inject(ModalController);

  @Input({ required: true }) incident!: MyIncident;

  readonly reachedIcon = checkmarkCircle;
  readonly pendingIcon = ellipseOutline;
  status = MY_INCIDENT_STATUS.open;
  categoryKey = '';
  tripLine = '';
  moments: IncidentMoment[] = [];

  ngOnInit(): void {
    const incident = this.incident;
    this.status = MY_INCIDENT_STATUS[incident.status];
    this.categoryKey = incidentCategoryKey(incident.category);
    this.tripLine = incidentTripLine(incident);
    this.moments = incidentMoments(incident);
  }

  dateTime(isoDate: string): string {
    return incidentDateTime(isoDate);
  }

  close(): void {
    void this.modalController.dismiss();
  }
}
