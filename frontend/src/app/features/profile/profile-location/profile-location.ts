import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonButton, IonIcon, IonToggle, ModalController } from '@ionic/angular';
import { checkmarkCircle, locateOutline, lockClosedOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserConsents } from '../../../core/models/user-consent.model';
import { LocationConsentService } from '../../../core/services/location/location-consent.service';
import {
  LocationPermission,
  LocationService,
} from '../../../core/services/location/location.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { openLegalModal } from '../../../shared/components/modals/legal-modal/legal-modal';
import { toConsentStamp } from '../consent-stamp';

type DevicePermission = Exclude<LocationPermission, 'revoked'>;

// «Ubicación» del Perfil: el consentimiento de la app (se da y se retira con
// el interruptor, y queda registrado con su fecha y su código) y, aparte, el
// permiso del dispositivo, que la app solo puede pedir o consultar (quitarlo
// es cosa de los ajustes del sistema). La app usa la ubicación solo con los dos
@Component({
  selector: 'app-profile-location',
  imports: [IonButton, IonIcon, IonToggle, TranslocoPipe],
  templateUrl: './profile-location.html',
  styleUrl: './profile-location.scss',
})
export class ProfileLocation implements OnInit {
  private readonly consent = inject(LocationConsentService);
  private readonly location = inject(LocationService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  readonly consents = signal<UserConsents | null>(null);
  readonly devicePermission = signal<DevicePermission | null>(null);
  readonly isAsking = signal(false);

  private readonly record = computed(() => this.consents()?.current.location ?? null);
  // Tras un cambio importante del texto, como si no la hubiera dado: el
  // interruptor la vuelve a dar, ya con el texto nuevo
  readonly isOutdated = computed(() => this.consents()?.outdated.includes('location') ?? false);
  readonly isGranted = computed(() => this.record()?.action === 'granted' && !this.isOutdated());
  // Fecha y código del último registro (autorizado o retirado)
  readonly stamp = computed(() => {
    const record = this.record();
    return record ? toConsentStamp(record) : null;
  });

  protected readonly checkIcon = checkmarkCircle;
  protected readonly locateIcon = locateOutline;
  protected readonly lockIcon = lockClosedOutline;

  ngOnInit(): void {
    void this.refresh();
  }

  // Si el usuario quitó el permiso en los ajustes del sistema con el
  // consentimiento dado, se registra la retirada (origen device)
  async refresh(): Promise<void> {
    const consents = await this.consent.load(true);
    const device = await this.location.checkDevicePermission();
    this.devicePermission.set(device);
    if (consents?.current.location?.action === 'granted' && device === 'denied') {
      await this.location.recordDeviceWithdrawal();
      this.consents.set(await this.consent.load());
      return;
    }
    this.consents.set(consents);
  }

  // Al retirarlo se pide confirmación: la app deja de usar la ubicación y queda
  // registrada la retirada, pero el permiso del dispositivo solo lo puede
  // quitar el usuario en sus ajustes. Si se arrepiente, el interruptor vuelve
  async handleToggle(event: CustomEvent<{ checked: boolean }>): Promise<void> {
    const action = event.detail.checked ? 'granted' : 'revoked';
    if (action === 'revoked' && !(await this.confirmRevoke())) {
      (event.target as HTMLIonToggleElement).checked = true;
      return;
    }
    try {
      this.consents.set(await this.consent.set(action));
      void this.toast.showSuccess(
        action === 'granted' ? 'Compartes tu ubicación.' : 'Has dejado de compartir tu ubicación.',
      );
    } catch {
      (event.target as HTMLIonToggleElement).checked = action === 'revoked';
      void this.toast.showError('No hemos podido guardar el cambio. Inténtalo de nuevo.');
    }
  }

  // El texto completo de «Uso de la ubicación», el que se acepta
  handleReadTerms(): Promise<void> {
    return openLegalModal(this.modalController, 'location');
  }

  // «Permitir»: pedir la ubicación una vez hace que el sistema pregunte
  async handleAllowDevice(): Promise<void> {
    this.isAsking.set(true);
    await this.location.getCurrentPoint().catch(() => undefined);
    this.devicePermission.set(await this.location.checkDevicePermission());
    this.isAsking.set(false);
  }

  private confirmRevoke(): Promise<boolean> {
    return this.confirm.ask({
      header: '¿Dejar de compartir tu ubicación?',
      message:
        'No la usaremos para proponerte paradas ni desvíos. Para bloquearla también en el dispositivo, hazlo en los ajustes del navegador o del móvil.',
      confirmText: 'Dejar de compartir',
      cancelText: 'Seguir compartiendo',
      isDestructive: true,
    });
  }
}
