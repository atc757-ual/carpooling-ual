import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { locateOutline } from 'ionicons/icons';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  LocationError,
  LocationFailure,
  LocationPermission,
  LocationService,
} from '../../../core/services/location/location.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { lazyLabels } from '../../../core/i18n/lazy-labels';

type DevicePermission = Exclude<LocationPermission, 'revoked'>;

// Por qué no se ha podido dar el permiso (revoked no pasa aquí: el permiso
// del dispositivo no depende del consentimiento de la app)
const DEVICE_ERRORS: Readonly<Record<LocationFailure, string>> = lazyLabels({
  denied: 'screens.profileDeviceLocation.denied',
  unavailable: 'screens.profileDeviceLocation.unavailable',
  revoked: 'screens.profileDeviceLocation.revoked',
});

// Fila «Ubicación» de Configuración (Mi perfil): consulta y solicita el permiso
// del GPS en este navegador o dispositivo
@Component({
  selector: 'app-profile-device-location',
  imports: [IonButton, IonIcon, TranslocoPipe],
  template: `
    <div class="profile__setting-row">
      <span class="profile__setting-text">
        <span class="text-body">{{ 'profile.location.devicePermission' | transloco }}</span>
        <span class="text-body-s text-color-muted">{{ hintKey() | transloco }}</span>
      </span>
      @switch (devicePermission()) {
        @case ('granted') {
          <span class="status status--accepted" role="status">
            <ion-icon [icon]="locateIcon" aria-hidden="true" />
            {{ 'profile.location.authorized' | transloco }}
          </span>
        }
        @case ('denied') {
          <span class="status status--pending" role="status">{{
            'profile.location.blocked' | transloco
          }}</span>
        }
        @case ('prompt') {
          <form (submit)="$event.preventDefault(); handleAllowDevice()">
            <ion-button
              class="profile-setting__action"
              fill="outline"
              type="submit"
              size="small"
              [attr.aria-label]="'profile.location.allowAria' | transloco"
              [disabled]="isAsking()"
            >
              <ion-icon slot="start" [icon]="locateIcon" aria-hidden="true" />
              {{ 'profile.location.allow' | transloco }}
            </ion-button>
          </form>
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

    .profile-setting__action {
      --background: transparent;
      --background-hover: var(--color-primary-subtle);
      --background-activated: var(--color-primary-subtle);
      --color: var(--color-primary);
      --border-color: var(--color-primary);
      --border-style: solid;
      --border-width: 1px;
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

    .status--accepted {
      background: var(--color-surface);
      border-color: var(--color-success);
      color: var(--color-success);
    }
  `,
})
export class ProfileDeviceLocation implements OnInit {
  private readonly location = inject(LocationService);
  private readonly toast = inject(ToastService);

  readonly devicePermission = signal<DevicePermission | null>(null);
  readonly isAsking = signal(false);

  protected readonly locateIcon = locateOutline;

  readonly hintKey = computed(() => {
    switch (this.devicePermission()) {
      case 'granted':
        return 'profile.location.deviceGrantedDesc';
      case 'denied':
        return 'profile.location.deviceDeniedDesc';
      default:
        return 'profile.location.devicePromptDesc';
    }
  });

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const device = await this.location.checkDevicePermission();
    this.devicePermission.set(device);
  }

  async handleAllowDevice(): Promise<void> {
    this.isAsking.set(true);
    try {
      const updated = await this.location.requestDevicePermission();
      this.devicePermission.set(updated);
      if (updated === 'granted') {
        void this.toast.showSuccess(
          translate('screens.profileDeviceLocation.ubicacionDispositivoPermitida'),
        );
      }
    } catch (error) {
      if (!(error instanceof LocationError)) {
        throw error;
      }
      this.devicePermission.set(await this.location.checkDevicePermission());
      void this.toast.showError(DEVICE_ERRORS[error.reason]);
    } finally {
      this.isAsking.set(false);
    }
  }
}
