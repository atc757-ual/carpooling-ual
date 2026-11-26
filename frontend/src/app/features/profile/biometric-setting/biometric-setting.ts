import { Component, inject, OnInit } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { fingerPrintOutline } from 'ionicons/icons';
import { BiometricLoginService } from '../../../core/services/auth/biometric-login.service';
import { CONFIRM_ICONS, ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';

// «Entrar con huella» en el bloque Cuenta de Perfil (app Android, con
// biometría en el móvil): dice si está activada y para qué correo, y la
// desactiva. Se activa al entrar con la contraseña (ver LoginPage), que es
// cuando la app la tiene para guardarla
@Component({
  selector: 'app-biometric-setting',
  imports: [IonButton, IonIcon, IonItem, IonLabel, TranslocoPipe],
  template: `
    @if (biometric.isAvailable()) {
      <ion-item class="profile__legal-row">
        <ion-icon slot="start" class="profile__legal-icon" [icon]="icon" aria-hidden="true" />
        <ion-label class="profile__legal-text">
          <span class="text-body text-body--strong">{{
            'auth.biometric.settingTitle' | transloco
          }}</span>
          <span class="text-body-s text-color-muted">
            @if (biometric.enabledEmail(); as email) {
              {{ 'auth.biometric.settingOn' | transloco: { email } }}
            } @else {
              {{ 'auth.biometric.settingOff' | transloco }}
            }
          </span>
        </ion-label>
        @if (biometric.isEnabled()) {
          <ion-button slot="end" fill="clear" size="small" (click)="handleDisable()">
            {{ 'auth.biometric.disable' | transloco }}
          </ion-button>
        }
      </ion-item>
    }
  `,
  // Las filas del bloque Cuenta son del SCSS de Perfil, que no llega aquí
  // (encapsulación): las mismas variables de esa fila (.profile__legal-row)
  styles: `
    ion-item {
      --background: var(--color-surface);
      --padding-start: var(--space-s);
      --inner-padding-end: var(--space-s);
      --min-height: var(--control-height-s);
      --color: var(--color-text);

      border-bottom: var(--border-width-s) solid var(--color-border-subtle);
    }

    .profile__legal-icon {
      margin-inline-end: var(--space-s);
      font-size: var(--icon-size-l);
      color: var(--color-primary);
    }

    .profile__legal-text {
      display: flex;
      flex-direction: column;
      gap: var(--space-xxs);
      white-space: normal;
    }
  `,
})
export class BiometricSetting implements OnInit {
  protected readonly biometric = inject(BiometricLoginService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly icon = fingerPrintOutline;

  // Sin esperar: la pantalla se pinta ya y el botón aparece al saberlo
  ngOnInit(): void {
    void this.biometric.load();
  }

  async handleDisable(): Promise<void> {
    const isConfirmed = await this.confirm.ask({
      header: this.transloco.translate('auth.biometric.disableTitle'),
      message: this.transloco.translate('auth.biometric.disableMessage'),
      confirmText: this.transloco.translate('auth.biometric.disable'),
      cancelText: this.transloco.translate('common.cancel'),
      icon: CONFIRM_ICONS.biometric,
    });
    if (!isConfirmed) {
      return;
    }
    await this.biometric.disable();
    void this.toast.showSuccess(this.transloco.translate('auth.biometric.disabled'));
  }
}
