import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, Input, signal } from '@angular/core';
import { IonButton, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { locationOutline, notificationsOutline } from 'ionicons/icons';
import {
  LocationError,
  LocationService,
} from '../../../../core/services/location/location.service';
import { PushNotificationsService } from '../../../../core/services/push/push-notifications.service';
import { openLegalModal } from '../legal-modal/legal-modal';

type PermissionState = 'idle' | 'busy' | 'done' | 'blocked';

// Los permisos al entrar: cada uno con su botón, porque son decisiones
// distintas. Solo los del dispositivo: el consentimiento de la app para usar la
// ubicación se da al usarla («Usar mi ubicación») o en Perfil → Privacidad. Lo
// que no se active se volverá a ofrecer cuando haga falta
@Component({
  selector: 'app-permissions-modal',
  imports: [IonButton, IonIcon, NgTemplateOutlet, TranslocoPipe],
  templateUrl: './permissions-modal.html',
  styleUrls: ['../confirm-modal/confirm-modal.scss', './permissions-modal.scss'],
})
export class PermissionsModal {
  private readonly modalController = inject(ModalController);
  private readonly push = inject(PushNotificationsService);
  private readonly location = inject(LocationService);

  // Los pasa ModalController (componentProps)
  @Input() canAskPush = false;
  @Input() canAskLocation = false;

  readonly pushState = signal<PermissionState>('idle');
  readonly locationState = signal<PermissionState>('idle');
  // Con todo respondido, el botón deja de decir «Más tarde»
  readonly isAnswered = computed(
    () =>
      (!this.canAskPush || isSettled(this.pushState())) &&
      (!this.canAskLocation || isSettled(this.locationState())),
  );

  protected readonly pushIcon = notificationsOutline;
  protected readonly locationIcon = locationOutline;

  async handleEnablePush(): Promise<void> {
    this.pushState.set('busy');
    try {
      this.pushState.set((await this.push.enable()) ? 'done' : 'blocked');
    } catch {
      this.pushState.set('blocked');
    }
  }

  // Solo el permiso del dispositivo: el sistema lo pide al leer la posición.
  // Sin señal el permiso ya está dado: cuenta como activada
  async handleEnableLocation(): Promise<void> {
    this.locationState.set('busy');
    try {
      const permission = await this.location.requestDevicePermission();
      this.locationState.set(permission === 'granted' ? 'done' : 'blocked');
    } catch (error) {
      if (!(error instanceof LocationError)) {
        this.locationState.set('idle');
        throw error;
      }
      this.locationState.set(error.reason === 'unavailable' ? 'done' : 'blocked');
    }
  }

  handleReadTerms(): Promise<void> {
    return openLegalModal(this.modalController, 'location');
  }

  async handleClose(): Promise<void> {
    await this.modalController.dismiss(null, 'close');
  }
}

function isSettled(state: PermissionState): boolean {
  return state === 'done' || state === 'blocked';
}
