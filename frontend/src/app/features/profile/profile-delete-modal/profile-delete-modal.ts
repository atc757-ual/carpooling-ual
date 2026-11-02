import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { alertCircleOutline, close, heartOutline, warningOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { CelebrationService } from '../../../core/services/ui/celebration.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { IdentityCheck } from '../identity-check/identity-check';

// Si el código caduca o se anula antes de confirmar, hay que pedir otro
const CODE_ERRORS: ReadonlySet<string> = new Set([
  'INVALID_VERIFICATION_CODE',
  'TOO_MANY_ATTEMPTS',
]);

// Eliminar la cuenta: confirmar la identidad con un código al correo
// (IdentityCheck; con viajes activos el backend avisa ya al pedirlo) y, en
// rojo, lo que supone, la despedida y «Eliminar definitivamente» o «Mantener
// mi cuenta». Al eliminarla, cierra la sesión y vuelve a la bienvenida. Se
// abre con ModalController; cierra con el rol 'deleted', 'kept' (se queda:
// aviso y confeti) o 'cancel'
@Component({
  selector: 'app-profile-delete-modal',
  imports: [
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslocoPipe,
    IdentityCheck,
  ],
  templateUrl: './profile-delete-modal.html',
  styleUrl: './profile-delete-modal.scss',
})
export class ProfileDeleteModal {
  private readonly auth = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly celebration = inject(CelebrationService);

  // El código ya comprobado; sin él, se está confirmando la identidad
  readonly verifiedCode = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isDeleting = signal(false);

  readonly requestCode = () => this.usersService.requestAccountDeletion();
  readonly verifyCode = (code: string) => this.usersService.verifyAccountDeletionCode(code);
  // Lo que hay que cumplir para darse de baja (el backend lo comprueba al
  // pedir el código: ACCOUNT_HAS_ACTIVE_TRIPS)
  protected readonly requirementKeys = [
    'profile.deleteModal.requirementDriver',
    'profile.deleteModal.requirementPassenger',
    'profile.deleteModal.requirementPending',
  ];
  protected readonly closeIcon = close;
  protected readonly warningIcon = warningOutline;
  protected readonly heartIcon = heartOutline;
  protected readonly alertIcon = alertCircleOutline;

  handleVerified(code: string): void {
    this.verifiedCode.set(code);
  }

  async handleDelete(): Promise<void> {
    const code = this.verifiedCode();
    if (code === null || this.isDeleting()) {
      return;
    }
    this.errorMessage.set(null);
    this.isDeleting.set(true);
    try {
      await this.usersService.confirmAccountDeletion(code);
      await this.modalController.dismiss(null, 'deleted');
      await this.auth.logout();
      await this.router.navigateByUrl('/auth/welcome');
      void this.toast.showSuccess(this.transloco.translate('profile.deleteModal.deleted'));
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      this.errorMessage.set(getErrorMessage(apiError));
      // El código ya no vale: vuelta a pedir otro
      if (CODE_ERRORS.has(apiError.code)) {
        this.verifiedCode.set(null);
      }
    } finally {
      this.isDeleting.set(false);
    }
  }

  // «Mantener mi cuenta»: se celebra que se queda (aviso verde y confeti)
  async handleKeep(): Promise<void> {
    await this.modalController.dismiss(null, 'kept');
    void this.toast.showSuccess(this.transloco.translate('profile.deleteModal.kept'));
    void this.celebration.celebrate();
  }

  close(): void {
    void this.modalController.dismiss(null, 'cancel');
  }
}
