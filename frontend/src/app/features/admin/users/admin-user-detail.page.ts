import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonCard,
  IonIcon,
  IonSkeletonText,
  ModalController,
} from '@ionic/angular';
import {
  alertCircleOutline,
  banOutline,
  carOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  handRightOutline,
  lockClosedOutline,
  pauseCircleOutline,
  peopleOutline,
  navigateOutline,
  personOutline,
  shieldOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { Profile } from '../../../core/models/user.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { confirmWithReason } from '../../../shared/components/modals/reason-confirm-modal/reason-confirm-modal';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import {
  consentLabel,
  formatDate,
  formatDateTime,
  incidentLabel,
  initialsOf,
  requestStatusLabel,
  ROLE_LABELS,
  tripRoute,
  tripStatusLabel,
} from './admin-user-detail-labels';
import { statusChips } from './admin-user-labels';
import { profileMessage, ProfileRow, profileRows, profileToast } from './admin-user-profiles';

const USERS_PATH = '/admin/users';
type Role = 'driver' | 'passenger';

// Detalle de un usuario en el panel (RF-25, CU-13), con las acciones del
// administrador: cada una con su confirmación y su motivo (auditoría)
@Component({
  selector: 'app-admin-user-detail-page',
  imports: [
    HeadingContent,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonIcon,
    IonSkeletonText,
    RouterLink,
  ],
  templateUrl: './admin-user-detail.page.html',
  styleUrl: './admin-user-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserDetailPage {
  private readonly adminUsers = inject(AdminUsersService);
  private readonly auth = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  // Parámetro de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  readonly detail = resource({
    params: () => this.id(),
    loader: ({ params }) => this.adminUsers.get(params),
  });

  readonly user = computed(() => (this.detail.hasValue() ? this.detail.value() : null));
  readonly chips = computed(() => {
    const user = this.user();
    return user ? statusChips({ ...user, '@type': 'AdminUserRow' }) : [];
  });
  readonly profiles = computed(() => {
    const user = this.user();
    return user ? profileRows(user, this.auth.currentUser()?.id) : [];
  });
  // Tarjeta «Acceso a la cuenta»: null en la propia y en una dada de baja
  readonly access = computed(() => {
    const user = this.user();
    if (user === null || user.id === this.auth.currentUser()?.id) {
      return null;
    }
    if (user.statuses.includes('deleted')) {
      return null;
    }
    const isDisabled = user.statuses.includes('disabled');
    return {
      isDisabled,
      text: isDisabled
        ? 'Inhabilitada: no puede iniciar sesión hasta que la rehabilites.'
        : 'Habilitada. Si la inhabilitas, no podrá iniciar sesión; se puede deshacer.',
    };
  });
  readonly suspensions = computed(() => {
    const suspensions = this.user()?.suspensions;
    return (['driver', 'passenger'] as const)
      .filter((role) => suspensions?.[role])
      .map((role) => ({ role, until: formatDate(suspensions?.[role] ?? '') }));
  });
  readonly error = computed(() => {
    const error = this.detail.error();
    return error ? ApiError.fromHttpError(error) : null;
  });
  readonly isNotFound = computed(() => this.error()?.code === 'USER_NOT_FOUND');
  readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? getErrorMessage(error) : null;
  });

  protected readonly icons = {
    profiles: peopleOutline,
    suspension: pauseCircleOutline,
    vehicles: carOutline,
    trips: navigateOutline,
    requests: handRightOutline,
    incidents: alertCircleOutline,
    consents: documentTextOutline,
    activate: checkmarkCircleOutline,
    deactivate: banOutline,
    access: lockClosedOutline,
  };
  protected readonly profileIcons: Readonly<Record<Profile, string>> = {
    driver: carOutline,
    passenger: personOutline,
    admin: shieldOutline,
  };
  protected readonly usersPath = USERS_PATH;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly text = {
    consentLabel,
    formatDate,
    formatDateTime,
    incidentLabel,
    initialsOf,
    requestStatusLabel,
    tripRoute,
    tripStatusLabel,
  };

  // Volver a la lista con sus filtros (si se llegó desde ella), desde la
  // cabecera móvil o desde la ruta (que lleva el enlace, pero no lo sigue)
  async handleBack(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    await this.router.navigateByUrl(USERS_PATH);
  }

  async handleProfile(row: ProfileRow): Promise<void> {
    const user = this.user();
    if (user === null) {
      return;
    }
    const isActive = !row.isActive;
    const isLastProfile =
      row.isActive && this.profiles().filter(({ isActive: on }) => on).length === 1;
    const isDone = await confirmWithReason(this.modalController, {
      header: `¿${row.actionText} el perfil de ${row.label.toLowerCase()}?`,
      message: isLastProfile
        ? `${profileMessage(row, user.name)} Se quedará sin ningún perfil activo y no podrá usar la app.`
        : profileMessage(row, user.name),
      confirmText: `${row.actionText} perfil`,
      action: (reason) =>
        this.adminUsers.setProfileActive(user.id, { profile: row.profile, isActive, reason }),
    });
    if (isDone) {
      void this.toast.showSuccess(profileToast(row));
      this.detail.reload();
    }
  }

  async handleAccess(isDisabled: boolean): Promise<void> {
    const user = this.user();
    if (user === null) {
      return;
    }
    const isDone = await confirmWithReason(this.modalController, {
      header: isDisabled ? '¿Rehabilitar la cuenta?' : '¿Inhabilitar la cuenta?',
      message: isDisabled
        ? `${user.name} podrá volver a iniciar sesión y usar sus perfiles.`
        : `${user.name} no podrá iniciar sesión hasta que la rehabilites. Se cerrarán sus sesiones y se cancelarán sus solicitudes pendientes.`,
      confirmText: isDisabled ? 'Rehabilitar cuenta' : 'Inhabilitar cuenta',
      action: (reason) =>
        this.adminUsers.setAccountAccess(user.id, { isDisabled: !isDisabled, reason }),
    });
    if (isDone) {
      void this.toast.showSuccess(isDisabled ? 'Cuenta rehabilitada.' : 'Cuenta inhabilitada.');
      this.detail.reload();
    }
  }

  async handleLiftSuspension(role: Role): Promise<void> {
    const user = this.user();
    if (user === null) {
      return;
    }
    const isDone = await confirmWithReason(this.modalController, {
      header: '¿Levantar la suspensión?',
      message: `${user.name} podrá volver a ${role === 'driver' ? 'publicar viajes' : 'pedir plaza'} ya. Sus cancelaciones tardías dejarán de contar.`,
      confirmText: 'Levantar suspensión',
      action: (reason) => this.adminUsers.liftSuspension(user.id, { role, reason }),
    });
    if (isDone) {
      void this.toast.showSuccess('Suspensión levantada.');
      this.detail.reload();
    }
  }

  handleRetry(): void {
    this.detail.reload();
  }
}
