import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { IonButton, IonIcon, IonInput, IonSpinner, ModalController } from '@ionic/angular';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { IdentityCheck } from '../identity-check/identity-check';
import { NEW_PASSWORD_VALIDATORS } from '../../../shared/utils/password.util';

// Si el código caduca o se anula antes de guardar, hay que pedir otro
const CODE_ERRORS: ReadonlySet<string> = new Set([
  'INVALID_VERIFICATION_CODE',
  'TOO_MANY_ATTEMPTS',
]);

function matchesPassword(confirmation: AbstractControl<string>): ValidationErrors | null {
  const password = confirmation.parent?.get('password')?.value as string | undefined;
  return confirmation.value && confirmation.value !== password ? { passwordMismatch: true } : null;
}

// Cambiar la contraseña con la sesión abierta: confirmar la identidad con un
// código al correo (IdentityCheck) y elegir la nueva. Se abre con
// ModalController; cierra con el rol 'saved' o 'cancel'
@Component({
  selector: 'app-profile-password-modal',
  imports: [
    ModalHeader,
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonInput,
    IonSpinner,
    TranslocoPipe,
    IonicFormStatus,
    IdentityCheck,
  ],
  templateUrl: './profile-password-modal.html',
  styleUrl: './profile-password-modal.scss',
})
export class ProfilePasswordModal {
  private readonly auth = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  // El código ya comprobado; sin él, se está confirmando la identidad
  readonly verifiedCode = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);
  readonly isPasswordVisible = signal(false);
  readonly isConfirmVisible = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    password: ['', NEW_PASSWORD_VALIDATORS],
    confirmation: ['', [Validators.required, matchesPassword]],
  });

  readonly requestCode = () => this.auth.requestPasswordChangeCode();
  readonly verifyCode = (code: string) => this.auth.verifyPasswordChangeCode(code);

  protected readonly lockIcon = lockClosedOutline;
  protected readonly checkIcon = checkmarkCircleOutline;
  protected readonly alertIcon = alertCircleOutline;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmation.updateValueAndValidity());
  }

  handleVerified(code: string): void {
    this.verifiedCode.set(code);
  }

  async handleSubmit(): Promise<void> {
    const code = this.verifiedCode();
    if (this.form.invalid || code === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    try {
      await this.auth.changePassword(code, this.form.controls.password.value);
      void this.toast.showSuccess(this.transloco.translate('profile.passwordModal.saved'));
      await this.modalController.dismiss(null, 'saved');
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      this.errorMessage.set(getErrorMessage(apiError));
      // El código ya no vale: vuelta a pedir otro
      if (CODE_ERRORS.has(apiError.code)) {
        this.verifiedCode.set(null);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  close(): void {
    void this.modalController.dismiss(null, 'cancel');
  }
}
