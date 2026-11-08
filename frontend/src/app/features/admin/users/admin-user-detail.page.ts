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
  pauseCircleOutline,
  peopleOutline,
  navigateOutline,
  personOutline,
  shieldOutline,
} from 'ionicons/icons';
import { AdminUserDetail } from '../../../core/models/admin-user.model';
import { ApiError } from '../../../core/models/api-error.model';
import { Profile } from '../../../core/models/user.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
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
  ratingLabel,
  requestStatusLabel,
  ROLE_LABELS,
  tripRoute,
  tripStatusLabel,
} from './admin-user-detail-labels';
import { PROFILE_LABELS, statusChips } from './admin-user-labels';

const USERS_PATH = '/admin/users';
type Role = 'driver' | 'passenger';

export interface ProfileRow {
  profile: Profile;
  label: string;
  // Si la cuenta tiene el perfil (activo o no)
  hasProfile: boolean;
  isActive: boolean;
  rating: string | null;
  // «Activo», «Desactivado» o «No lo tiene»
  stateText: string;
  actionText: string;
}

// Textos de la acción: el de administrador se da o se quita; los demás se
// activan o se desactivan
const ACTION_TEXTS = {
  admin: { active: 'Revocar', inactive: 'Conceder' },
  other: { active: 'Inhabilitar', inactive: 'Habilitar' },
} as const;

function stateTextFor(hasProfile: boolean, isActive: boolean): string {
  if (isActive) {
    return 'Activo';
  }
  return hasProfile ? 'Desactivado' : 'No lo tiene';
}

function actionTextFor(profile: Profile, isActive: boolean): string {
  const texts = profile === 'admin' ? ACTION_TEXTS.admin : ACTION_TEXTS.other;
  return isActive ? texts.active : texts.inactive;
}

// Lo que se puede hacer con cada perfil: activar o desactivar los de
// conductor y pasajero (si los tiene) y dar o quitar el de administrador
export function profileRows(detail: AdminUserDetail): ProfileRow[] {
  const byProfile = new Map(detail.profiles.map((status) => [status.profile, status]));
  return (['driver', 'passenger', 'admin'] as const)
    .filter((profile) => profile === 'admin' || byProfile.has(profile))
    .map((profile) => {
      const isActive = byProfile.get(profile)?.isActive ?? false;
      const isAdmin = profile === 'admin';
      return {
        profile,
        label: PROFILE_LABELS[profile],
        hasProfile: byProfile.has(profile),
        isActive,
        rating: isAdmin ? null : ratingLabel(detail.ratings[profile]),
        stateText: stateTextFor(byProfile.has(profile), isActive),
        actionText: actionTextFor(profile, isActive),
      };
    });
}

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
    return user ? profileRows(user) : [];
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

  // Volver a la lista con sus filtros (si se llegó desde ella)
  async handleBack(): Promise<void> {
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
        ? `${profileMessage(row.profile, isActive, user.name)} Se quedará sin ningún perfil activo y no podrá usar la app.`
        : profileMessage(row.profile, isActive, user.name),
      confirmText: `${row.actionText} perfil`,
      action: (reason) =>
        this.adminUsers.setProfileActive(user.id, { profile: row.profile, isActive, reason }),
    });
    if (isDone) {
      void this.toast.showSuccess(
        `Perfil de ${row.label.toLowerCase()} ${isActive ? 'habilitado' : 'inhabilitado'}.`,
      );
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

function profileMessage(profile: Profile, isActive: boolean, name: string): string {
  if (profile === 'admin') {
    return isActive
      ? `${name} podrá entrar en el panel de administración.`
      : `${name} dejará de tener acceso al panel de administración.`;
  }
  return isActive
    ? `${name} podrá volver a usar este perfil.`
    : `${name} no podrá usar este perfil y se cerrarán sus sesiones abiertas.`;
}
