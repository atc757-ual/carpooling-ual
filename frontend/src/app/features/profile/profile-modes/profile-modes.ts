import { Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
} from '@ionic/angular';
import { carOutline, personOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { RegisterProfile } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { UsersService } from '../../../core/services/users/users.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

interface ModeRow {
  profile: RegisterProfile;
  label: string;
  description: string;
  icon: string;
  isActive: boolean;
}

// «Mis perfiles» del Perfil: pasajero y conductor, cada uno activo o con
// «Activar». Activarlo renueva el token, que es el que lleva los perfiles;
// si un administrador lo desactivó, se muestra su error
@Component({
  selector: 'app-profile-modes',
  imports: [IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon],
  templateUrl: './profile-modes.html',
  styleUrl: './profile-modes.scss',
})
export class ProfileModes {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);

  readonly activating = signal<RegisterProfile | null>(null);
  readonly rows = computed<ModeRow[]>(() => {
    // Se recalcula cuando cambia el usuario de la sesión (al renovar el token)
    this.auth.currentUser();
    return [
      {
        profile: 'passenger',
        label: 'Pasajero',
        description: 'Buscas viajes y pides plaza.',
        icon: personOutline,
        isActive: this.auth.hasProfile('passenger'),
      },
      {
        profile: 'driver',
        label: 'Conductor',
        description: 'Publicas tus viajes y decides quién va contigo.',
        icon: carOutline,
        isActive: this.auth.hasProfile('driver'),
      },
    ];
  });
  readonly hasBoth = computed(() => this.rows().every(({ isActive }) => isActive));

  async handleActivate(profile: RegisterProfile): Promise<void> {
    this.activating.set(profile);
    try {
      await this.users.activateProfile(profile);
      await this.auth.refreshAccessToken();
      void this.toast.showSuccess(
        profile === 'driver' ? 'Ya puedes publicar viajes.' : 'Ya puedes pedir plaza.',
      );
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.activating.set(null);
    }
  }
}
