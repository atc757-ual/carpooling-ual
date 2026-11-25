import { computed, inject, resource, Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import type { MyIncident } from '../../../../core/models/my-incident.model';
import { IncidentsService } from '../../../../core/services/incidents/incidents.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { HELP_INCIDENT_PARAM } from '../help-center.util';
import { HelpIncidentModal } from './help-incident-modal';

// Días en que una incidencia atendida sigue arriba (para ver la respuesta)
export const RECENT_REVIEW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Si «Tus incidencias» va primero en Ayuda: con alguna registrada o en
// revisión, o atendida en los últimos 7 días
export function hasPriorityIncidents(incidents: readonly MyIncident[], now: Date): boolean {
  return incidents.some(
    ({ status, review }) =>
      status !== 'reviewed' ||
      (review !== null &&
        now.getTime() - new Date(review.reviewedAt).getTime() <= RECENT_REVIEW_DAYS * DAY_MS),
  );
}

// La ventana de una incidencia mía (desde «Tus incidencias» o su aviso)
export async function openHelpIncidentModal(
  modalController: ModalController,
  incident: MyIncident,
): Promise<void> {
  const modal = await modalController.create({
    component: HelpIncidentModal,
    cssClass: 'info-dialog',
    componentProps: { incident },
  });
  await modal.present();
}

export interface HelpIncidentsPriority {
  // Ya se sabe dónde va la columna (cargadas, o sin poder cargarlas)
  isReady: Signal<boolean>;
  // «Tus incidencias» y la columna de contacto van primero
  isFirst: Signal<boolean>;
}

// Para la página de Ayuda: si las incidencias van primero (con las más
// recientes, que son las que pueden estar activas)
export function injectHelpIncidentsPriority(): HelpIncidentsPriority {
  const incidents = inject(IncidentsService);
  const recent = resource({ loader: () => incidents.listMine(0) });
  return {
    isReady: computed(() => recent.status() !== 'loading'),
    isFirst: computed(
      () => recent.hasValue() && hasPriorityIncidents(recent.value().items, new Date()),
    ),
  };
}

// Abre la ventana de la incidencia del enlace (?incident=<id>, desde su
// aviso) y quita el parámetro, para no volver a abrirla al volver atrás
export function injectHelpIncidentLink(): () => Promise<void> {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const modalController = inject(ModalController);
  const incidents = inject(IncidentsService);
  const toast = inject(ToastService);
  return async () => {
    const id = route.snapshot.queryParamMap.get(HELP_INCIDENT_PARAM);
    if (!id) {
      return;
    }
    await router.navigate([], {
      relativeTo: route,
      queryParams: { [HELP_INCIDENT_PARAM]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    try {
      await openHelpIncidentModal(modalController, await incidents.getMine(id));
    } catch (error) {
      void toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  };
}
