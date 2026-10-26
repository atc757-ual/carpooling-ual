import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import {
  arrowBackOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';
import { HOME_PATH } from '../../../core/guards/redirect-paths';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { EmailSuggestions } from '../../../shared/components/ui/email-suggestions/email-suggestions';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getUalEmailErrorText, ualEmailValidator } from '../../../shared/utils/ual-email.util';

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

// Iniciar sesión (P·03) con el correo de la UAL y la contraseña. Al entrar,
// vuelve a la página que se pedía (?returnUrl=, ver authGuard) o al inicio
@Component({
  selector: 'app-login',
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
    EmailSuggestions,
    IonicFormStatus,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['../auth-form.scss', './login.page.scss'],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // Parámetro ?returnUrl= de la ruta (withComponentInputBinding)
  readonly returnUrl = input<string>();

  readonly form = inject(NonNullableFormBuilder).group({
    // Con el dominio también aquí: un correo de fuera no llega al servidor
    email: ['', [Validators.required, Validators.email, ualEmailValidator()]],
    // Mínimo de 8 como en el registro: una más corta no puede ser correcta
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });
  readonly isSubmitting = signal(false);
  readonly isPasswordVisible = signal(false);

  protected readonly backIcon = arrowBackOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;

  emailErrorText(): string {
    return getUalEmailErrorText(this.form.controls.email);
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login({ email, password });
      await this.router.navigateByUrl(this.getSafeReturnUrl());
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      if (apiError.code === EMAIL_NOT_VERIFIED) {
        await this.goToVerify(email);
      } else {
        void this.toast.showError(getErrorMessage(apiError));
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Contraseña correcta pero correo sin verificar: se pide un código nuevo (el
  // del registro puede haber caducado) y se lleva a la pantalla del código
  private async goToVerify(email: string): Promise<void> {
    this.auth.setPendingVerificationEmail(email);
    await this.auth.resendVerificationCode(email).catch(() => undefined);
    await this.router.navigateByUrl('/auth/verify');
  }

  // Solo rutas de la propia app («/trips», nunca «//otro-sitio.com»), para que
  // un enlace manipulado no lleve a otra web después del login
  private getSafeReturnUrl(): string {
    const url = this.returnUrl();
    return url?.startsWith('/') && !url.startsWith('//') ? url : HOME_PATH;
  }
}
