import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonRouterLink,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { arrowBackOutline, eyeOffOutline, eyeOutline, lockClosedOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { PasswordResetService } from '../../../core/services/auth/password-reset.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

// Mismos límites que la API (y que el registro)
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
// El código ha dejado de valer entre la pantalla anterior y esta (caducado o
// anulado): hay que pedir otro
const EXPIRED_CODE_ERRORS = new Set(['INVALID_VERIFICATION_CODE', 'TOO_MANY_ATTEMPTS']);

// La confirmación tiene que coincidir con la contraseña nueva. En el propio
// campo (no en el formulario) para que Ionic muestre el error bajo él
function matchesPassword(confirmation: AbstractControl<string>): ValidationErrors | null {
  const password = confirmation.parent?.get('password')?.value as string | undefined;
  return confirmation.value && confirmation.value !== password ? { passwordMismatch: true } : null;
}

// Recuperar la contraseña, paso 3 (diseño 07): la contraseña nueva. Al
// guardarla, la API cierra todas las sesiones; no se inicia sesión aquí, la
// pantalla invita a ir al login
@Component({
  selector: 'app-new-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonRouterLink,
    IonSpinner,
    IonTitle,
    IonToolbar,
    AuthLayout,
    IonicFormStatus,
  ],
  templateUrl: './new-password.page.html',
  styleUrls: ['../auth-form.scss', './new-password.page.scss'],
})
export class NewPasswordPage implements OnInit {
  private readonly passwordReset = inject(PasswordResetService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly form = inject(NonNullableFormBuilder).group({
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    ],
    confirmation: ['', [Validators.required, matchesPassword]],
  });
  readonly isSubmitting = signal(false);
  readonly isPasswordVisible = signal(false);
  readonly isConfirmationVisible = signal(false);
  // Contraseña cambiada: en lugar del formulario, el aviso verde
  readonly isDone = signal(false);
  // El código ya no vale: en lugar del formulario, el aviso ámbar
  readonly isCodeExpired = signal(false);

  protected readonly backIcon = arrowBackOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;

  constructor() {
    // Si se cambia la contraseña después de confirmarla, se vuelve a comparar
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmation.updateValueAndValidity());
  }

  ngOnInit(): void {
    // Sin código comprobado (p. ej. al recargar la página) se vuelve a empezar
    if (!this.passwordReset.hasVerifiedCode()) {
      void this.router.navigateByUrl('/auth/forgot-password');
    }
  }

  confirmationErrorText(): string {
    return this.form.controls.confirmation.hasError('passwordMismatch')
      ? 'Las contraseñas no coinciden.'
      : 'Repite la contraseña nueva.';
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    try {
      await this.passwordReset.resetPassword(this.form.getRawValue().password);
      this.isDone.set(true);
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      if (EXPIRED_CODE_ERRORS.has(apiError.code)) {
        this.isCodeExpired.set(true);
      } else {
        void this.toast.showError(getErrorMessage(apiError));
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
