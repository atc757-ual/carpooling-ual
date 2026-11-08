import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { checkmarkCircle, notificationsOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { PushNotificationsService } from '../../../core/services/push/push-notifications.service';
import { ToastService } from '../../../core/services/ui/toast.service';

// Fila «Notificaciones» de Configuración (Mi perfil): activa o desactiva las
// push en este dispositivo con botón o tag de estado. El permiso del navegador
// se pide al activarlas, nunca al abrir la app
@Component({
  selector: 'app-profile-push-setting',
  imports: [IonButton, IonIcon, TranslocoPipe],
  template: `
    <div class="profile__setting-row">
      <span class="profile__setting-text">
        <span class="text-body">{{ 'profile.push' | transloco }}</span>
        <span class="text-caption text-color-muted">{{ hintKey() | transloco }}</span>
      </span>
      @switch (push.status()) {
        @case ('on') {
          <button
            type="button"
            class="status status--accepted profile-push__status-btn"
            (click)="handleDisable()"
            [attr.aria-label]="'profile.pushDisable' | transloco"
            [title]="'profile.pushDisable' | transloco"
            [disabled]="isBusy()"
          >
            <ion-icon [icon]="checkIcon" aria-hidden="true" />
            <span>{{ 'profile.pushOn' | transloco }}</span>
          </button>
        }
        @case ('off') {
          <form (submit)="$event.preventDefault(); handleEnable()">
            <ion-button
              class="profile-setting__action"
              type="submit"
              size="small"
              [disabled]="isBusy()"
            >
              <ion-icon slot="start" [icon]="bellIcon" aria-hidden="true" />
              {{ 'profile.pushEnable' | transloco }}
            </ion-button>
          </form>
        }
        @case ('denied') {
          <span class="status status--pending">{{ 'profile.pushDeniedTag' | transloco }}</span>
        }
        @case ('unsupported') {
          <span class="status">{{ 'profile.pushUnsupportedTag' | transloco }}</span>
        }
      }
    </div>
  `,
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

    .profile-push__status-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
      border: 0;
      cursor: pointer;
      font: inherit;
      background: var(--color-success-subtle);
      color: var(--color-success);

      &:hover {
        opacity: 0.85;
      }
    }

    .profile-setting__action {
      --background: var(--color-warning-subtle);
      --background-hover: var(--color-warning-subtle);
      --color: var(--color-warning-text);
      --border-radius: var(--radius-s);
      --box-shadow: none;
      height: 2rem;
      min-height: 2rem;
      font-weight: var(--font-weight-semibold);
      margin: 0;

      &:hover {
        opacity: 0.9;
      }
    }
  `,
})
export class ProfilePushSetting {
  readonly push = inject(PushNotificationsService);
  private readonly toast = inject(ToastService);

  readonly isBusy = signal(false);
  readonly isOn = computed(() => this.push.status() === 'on');
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

  protected readonly checkIcon = checkmarkCircle;
  protected readonly bellIcon = notificationsOutline;

  async handleEnable(): Promise<void> {
    if (this.isOn()) return;
    this.isBusy.set(true);
    try {
      if (await this.push.enable()) {
        void this.toast.showSuccess('Te avisaremos aunque tengas la app cerrada.');
      }
    } catch {
      void this.toast.showError('No hemos podido activar las notificaciones. Inténtalo de nuevo.');
    } finally {
      this.isBusy.set(false);
    }
  }

  async handleDisable(): Promise<void> {
    if (!this.isOn()) return;
    this.isBusy.set(true);
    try {
      await this.push.disable();
    } catch {
      void this.toast.showError('No hemos podido desactivar las notificaciones.');
    } finally {
      this.isBusy.set(false);
    }
  }


}
