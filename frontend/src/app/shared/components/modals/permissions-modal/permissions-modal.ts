import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, Input, signal } from '@angular/core';
import { IonButton, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { locationOutline, notificationsOutline } from 'ionicons/icons';
import { LocationConsentService } from '../../../../core/services/location/location-consent.service';
import {
  LocationError,
  LocationService,
} from '../../../../core/services/location/location.service';
import { PushNotificationsService } from '../../../../core/services/push/push-notifications.service';
import { openLegalModal } from '../legal-modal/legal-modal';

type PermissionState = 'idle' | 'busy' | 'done' | 'blocked';

// Los permisos al entrar: cada uno con su botón, porque son decisiones
// distintas (la ubicación además es un consentimiento registrado). Lo que no
// se active se volverá a ofrecer cuando haga falta
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
  private readonly consent = inject(LocationConsentService);

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

  // Registra el consentimiento y lee la posición: así el sistema pide su
  // permiso ahora. Sin señal el permiso ya está dado: cuenta como activada
  async handleEnableLocation(): Promise<void> {
    this.locationState.set('busy');
    try {
      await this.consent.set('granted', 'location_prompt');
      await this.location.getCurrentPoint();
      this.locationState.set('done');
    } catch (error) {
      const isGranted = error instanceof LocationError && error.reason === 'unavailable';
      this.locationState.set(isGranted ? 'done' : 'blocked');
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
