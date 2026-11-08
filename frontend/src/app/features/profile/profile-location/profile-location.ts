import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonIcon, IonToggle, ModalController } from '@ionic/angular';
import { checkmarkCircle, lockClosedOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserConsents } from '../../../core/models/user-consent.model';
import { LocationConsentService } from '../../../core/services/location/location-consent.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { openLegalModal } from '../../../shared/components/modals/legal-modal/legal-modal';
import { toConsentStamp } from '../consent-stamp';

// «Ubicación» en Privacidad (Mi perfil): consentimiento voluntario del usuario
// bajo el RGPD (art. 6.1.a) para rellenar paradas y sugerencias automáticas.
// Cuenta con sello de fecha y huella digital verificable
@Component({
  selector: 'app-profile-location',
  imports: [IonIcon, IonToggle, TranslocoPipe],
  templateUrl: './profile-location.html',
  styleUrl: './profile-location.scss',
})
export class ProfileLocation implements OnInit {
  private readonly consent = inject(LocationConsentService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  readonly consents = signal<UserConsents | null>(null);

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
  protected readonly lockIcon = lockClosedOutline;

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const consents = await this.consent.load(true);
    this.consents.set(consents);
  }

  // Al retirarlo se pide confirmación: la app deja de usar la ubicación para
  // sugerencias y queda registrada la retirada
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

  private confirmRevoke(): Promise<boolean> {
    return this.confirm.ask({
      header: '¿Dejar de tratar tu ubicación para análisis?',
      message:
        'No la usaremos para calcular emisiones ahorradas ni optimizar rutas. Podrás seguir buscando y publicando viajes indicando los puntos de forma manual.',
      confirmText: 'Dejar de permitir',
      cancelText: 'Seguir permitiendo',
      isDestructive: true,
    });
  }
}
