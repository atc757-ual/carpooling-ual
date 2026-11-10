import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { locateOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  LocationError,
  LocationFailure,
  LocationPermission,
  LocationService,
} from '../../../core/services/location/location.service';
import { ToastService } from '../../../core/services/ui/toast.service';

type DevicePermission = Exclude<LocationPermission, 'revoked'>;

// Por qué no se ha podido dar el permiso (revoked no pasa aquí: el permiso
// del dispositivo no depende del consentimiento de la app)
const DEVICE_ERRORS: Record<LocationFailure, string> = {
  denied: 'Has bloqueado la ubicación. Actívala en los ajustes del navegador o del móvil.',
  unavailable:
    'No hemos podido acceder a tu ubicación. Comprueba que esté activada en el dispositivo.',
  revoked: 'No hemos podido acceder a tu ubicación. Inténtalo de nuevo.',
};

// Fila «Ubicación» de Configuración (Mi perfil): consulta y solicita el permiso
// del GPS en este navegador o dispositivo
@Component({
  selector: 'app-profile-device-location',
  imports: [IonButton, IonIcon, TranslocoPipe],
  template: `
    <div class="profile__setting-row">
      <span class="profile__setting-text">
        <span class="text-body">{{ 'profile.location.devicePermission' | transloco }}</span>
        <span class="text-caption text-color-muted">{{ hintKey() | transloco }}</span>
      </span>
      @switch (devicePermission()) {
        @case ('granted') {
          <span class="status status--accepted">
            <ion-icon [icon]="locateIcon" aria-hidden="true" />
            {{ 'profile.location.authorized' | transloco }}
          </span>
        }
        @case ('denied') {
          <span class="status status--pending">{{ 'profile.location.blocked' | transloco }}</span>
        }
        @case ('prompt') {
          <form (submit)="$event.preventDefault(); handleAllowDevice()">
            <ion-button
              class="profile-setting__action"
              type="submit"
              size="small"
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
        void this.toast.showSuccess('Ubicación del dispositivo permitida.');
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
