import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  Input,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton, IonIcon, ModalController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { locationOutline, notificationsOutline } from 'ionicons/icons';
import {
  LocationError,
  LocationService,
} from '../../../../core/services/location/location.service';
import { PushNotificationsService } from '../../../../core/services/push/push-notifications.service';
import { LegalDocumentText } from '../../ui/legal-document/legal-document';
import { ModalHeader } from '../modal-header/modal-header';

type PermissionState = 'idle' | 'busy' | 'done' | 'blocked';

// Los permisos al entrar: cada uno con su botón, porque son decisiones
// distintas. Solo los del dispositivo: el consentimiento de la app para usar la
// ubicación se da al usarla («Usar mi ubicación») o en Perfil → Privacidad. Lo
// que no se active se volverá a ofrecer cuando haga falta
@Component({
  selector: 'app-permissions-modal',
  imports: [IonButton, IonIcon, LegalDocumentText, ModalHeader, NgTemplateOutlet, TranslocoPipe],
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
  readonly isReadingTerms = signal(false);
  private readonly injector = inject(Injector);
  private readonly termsSection = viewChild<ElementRef<HTMLElement>>('terms');
  private readonly termsLink = viewChild<ElementRef<HTMLElement>>('termsLink');
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

  // «Uso de la ubicación» en la misma ventana (sin abrir otra encima), con la
  // flecha para volver a los permisos
  handleReadTerms(): void {
    this.isReadingTerms.set(true);
    afterNextRender(() => this.termsSection()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  handleCloseTerms(): void {
    this.isReadingTerms.set(false);
    afterNextRender(() => this.termsLink()?.nativeElement.focus(), { injector: this.injector });
  }

  async handleClose(): Promise<void> {
    await this.modalController.dismiss(null, 'close');
  }
}

function isSettled(state: PermissionState): boolean {
  return state === 'done' || state === 'blocked';
}
