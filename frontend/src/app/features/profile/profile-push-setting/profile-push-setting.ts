import { Component, computed, inject, signal } from '@angular/core';
import { IonToggle } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PushNotificationsService } from '../../../core/services/push/push-notifications.service';
import { ToastService } from '../../../core/services/ui/toast.service';

// Fila «Notificaciones» de Configuración (Mi perfil): activa o desactiva las
// push en este dispositivo. El permiso del navegador se pide al activarlas,
// nunca al abrir la app; si está bloqueado o no hay push, se dice por qué
@Component({
  selector: 'app-profile-push-setting',
  imports: [IonToggle, TranslocoPipe],
  template: `
    <div class="profile__setting-row">
      <span class="profile__setting-text">
        <span class="text-body">{{ 'profile.push' | transloco }}</span>
        <span class="text-caption text-color-muted">{{ hintKey() | transloco }}</span>
      </span>
      <ion-toggle
        [checked]="isOn()"
        [disabled]="isLocked() || isBusy()"
        [attr.aria-label]="'profile.push' | transloco"
        (ionChange)="handleToggle($event.detail.checked)"
      />
    </div>
  `,
  // Los de las demás filas de Configuración (profile.page.scss), que no llegan
  // dentro de este componente
  styles: `
    .profile__setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-s);
    }

    .profile__setting-text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.125rem; // 2px
      min-width: 0;
    }
  `,
})
export class ProfilePushSetting {
  private readonly push = inject(PushNotificationsService);
  private readonly toast = inject(ToastService);

  readonly isBusy = signal(false);
  readonly isOn = computed(() => this.push.status() === 'on');
  // Bloqueadas en el navegador o sin push: no se pueden tocar desde aquí
  readonly isLocked = computed(() => {
    const status = this.push.status();
    return status === 'denied' || status === 'unsupported';
  });
  readonly hintKey = computed(() => {
    switch (this.push.status()) {
      case 'denied':
        return 'profile.pushDenied';
      case 'unsupported':
        return 'profile.pushUnsupported';
      default:
        return 'profile.pushHint';
    }
  });

  async handleToggle(isChecked: boolean): Promise<void> {
    if (isChecked === this.isOn()) {
      return;
    }
    this.isBusy.set(true);
    try {
      if (!isChecked) {
        await this.push.disable();
        return;
      }
      if (await this.push.enable()) {
        void this.toast.showSuccess('Te avisaremos aunque tengas la app cerrada.');
      }
    } catch {
      void this.toast.showError('No hemos podido activar las notificaciones. Inténtalo de nuevo.');
    } finally {
      this.isBusy.set(false);
    }
  }
}
