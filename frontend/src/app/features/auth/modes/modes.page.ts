import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonRouterLink,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  arrowBackOutline,
  carOutline,
  checkmarkCircle,
  ellipseOutline,
  personOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { HOME_PATH } from '../../../core/guards/redirect-paths';
import { ApiError } from '../../../core/models/api-error.model';
import { RegisterProfile } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { UsersService } from '../../../core/services/users/users.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

export type ModeChoice = 'passenger' | 'driver' | 'both';

interface ModeOption {
  value: ModeChoice;
  title: string;
  description: string;
  icon: string;
}

// Perfiles que activa cada opción (con «Ambos» se empieza como pasajero)
const PROFILES_BY_CHOICE: Readonly<Record<ModeChoice, RegisterProfile[]>> = {
  passenger: ['passenger'],
  driver: ['driver'],
  both: ['passenger', 'driver'],
};

// Elegir modo (CU-01) después de verificar el correo: pasajero, conductor o
// ambos. Con la sesión ya abierta; se cambia después desde el perfil
@Component({
  selector: 'app-modes',
  imports: [
    RouterLink,
    IonButton,
    IonRouterLink,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    AuthLayout,
  ],
  templateUrl: './modes.page.html',
  styleUrls: ['../auth-form.scss', './modes.page.scss'],
})
export class ModesPage {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly options: ModeOption[] = [
    {
      value: 'passenger',
      title: 'Pasajero',
      description: 'Busca viajes y solicita una plaza.',
      icon: personOutline,
    },
    {
      value: 'driver',
      title: 'Conductor',
      description: 'Publica rutas con tu vehículo.',
      icon: carOutline,
    },
    {
      value: 'both',
      title: 'Ambos',
      description: 'Busca o publica según tu día.',
      icon: swapHorizontalOutline,
    },
  ];
  protected readonly backIcon = arrowBackOutline;
  // Selector de cada tarjeta: círculo vacío o marcado
  protected readonly selectedIcon = checkmarkCircle;
  protected readonly unselectedIcon = ellipseOutline;

  readonly choice = signal<ModeChoice | null>(null);
  readonly isSubmitting = signal(false);
  readonly submitLabel = computed(() => {
    const choice = this.choice();
    if (choice === null) {
      return 'Continuar';
    }
    return choice === 'driver' ? 'Continuar como conductor' : 'Continuar como pasajero';
  });

  async handleSubmit(): Promise<void> {
    const choice = this.choice();
    if (choice === null) {
      return;
    }
    this.isSubmitting.set(true);
    try {
      // A la vez: el backend bloquea la fila del usuario y las aplica por turnos
      await Promise.all(
        PROFILES_BY_CHOICE[choice].map((profile) => this.users.activateProfile(profile)),
      );
      // Los perfiles van en el token: se renueva para que la app los vea
      await this.auth.refreshAccessToken();
      await this.router.navigateByUrl(HOME_PATH);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
