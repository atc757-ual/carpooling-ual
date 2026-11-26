import { Component, inject, input, OnInit, signal } from '@angular/core';
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  arrowBackOutline,
  eyeOffOutline,
  eyeOutline,
  fingerPrintOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';
import { ApiError, rethrowUnlessApiError } from '../../../core/models/api-error.model';
import { AppContextService } from '../../../core/services/ui/app-context.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { BiometricLoginService } from '../../../core/services/auth/biometric-login.service';
import { CONFIRM_ICONS, ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { Combobox } from '../../../shared/components/ui/combobox/combobox';
import { EmailSuggestions } from '../../../shared/components/ui/email-suggestions/email-suggestions';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getAuthErrorMessage } from '../../../shared/utils/auth-error-message.util';
import { getUalEmailErrorKey, ualEmailValidator } from '../../../shared/utils/ual-email.util';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../../shared/utils/password.util';

const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';
const INVALID_CREDENTIALS = 'INVALID_CREDENTIALS';

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
    Combobox,
    EmailSuggestions,
    IonicFormStatus,
    TranslocoPipe,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['../auth-form.scss', './login.page.scss'],
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly appContext = inject(AppContextService);
  private readonly confirm = inject(ConfirmService);
  protected readonly biometric = inject(BiometricLoginService);

  // Parámetro ?returnUrl= de la ruta (withComponentInputBinding)
  readonly returnUrl = input<string>();

  readonly form = inject(NonNullableFormBuilder).group({
    // Con el dominio también aquí: un correo de fuera no llega al servidor
    email: ['', [Validators.required, Validators.email, ualEmailValidator()]],
    // Entre 8 y 72 caracteres como exige el backend
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    ],
  });
  readonly isSubmitting = signal(false);
  readonly isPasswordVisible = signal(false);

  protected readonly backIcon = arrowBackOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;
  protected readonly fingerPrintIcon = fingerPrintOutline;

  // Sin esperar: la pantalla se pinta ya y el botón aparece al saberlo
  ngOnInit(): void {
    void this.biometric.load();
  }

  emailErrorKey(): string {
    return getUalEmailErrorKey(this.form.controls.email);
  }

  passwordErrorKey(): string {
    return this.form.controls.password.hasError('required')
      ? 'auth.validation.passwordRequired'
      : 'auth.validation.passwordLength';
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
      await this.offerBiometric({ email, password });
      await this.goToEntry();
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      if (apiError.code === EMAIL_NOT_VERIFIED) {
        await this.goToVerify(email);
      } else {
        void this.toast.showError(getAuthErrorMessage(apiError, this.transloco));
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Entrar con la huella (app Android, si se activó en este móvil)
  async handleBiometricLogin(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      if (await this.biometric.login()) {
        await this.goToEntry();
      } else if (!this.biometric.isEnabled()) {
        void this.toast.showError(this.transloco.translate('auth.biometric.unavailable'));
      }
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      const message =
        apiError.code === INVALID_CREDENTIALS
          ? this.transloco.translate('auth.biometric.passwordChanged')
          : getAuthErrorMessage(apiError, this.transloco);
      void this.toast.showError(message);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Tras entrar con la contraseña, una vez por cuenta: «¿Entrar con huella la
  // próxima vez?». Un fallo al guardarla no impide seguir: ya hay sesión
  private async offerBiometric(credentials: { email: string; password: string }): Promise<void> {
    if (!(await this.biometric.shouldOffer(credentials.email))) {
      return;
    }
    const isAccepted = await this.confirm.ask({
      header: this.transloco.translate('auth.biometric.offerTitle'),
      message: this.transloco.translate('auth.biometric.offerMessage'),
      confirmText: this.transloco.translate('auth.biometric.offerConfirm'),
      cancelText: this.transloco.translate('auth.biometric.offerLater'),
      icon: CONFIRM_ICONS.biometric,
    });
    if (!isAccepted) {
      await this.biometric.decline(credentials.email);
      return;
    }
    try {
      if (await this.biometric.enable(credentials)) {
        void this.toast.showSuccess(this.transloco.translate('auth.biometric.enabled'));
      }
    } catch {
      // El Keystore ha fallado (raro): se entra igual y se podrá activar más
      // adelante; no hay nada que el usuario pueda arreglar aquí
      void this.toast.showError(this.transloco.translate('auth.biometric.enableFailed'));
    }
  }

  private async goToEntry(): Promise<void> {
    await this.router.navigateByUrl(this.getSafeReturnUrl() ?? (await this.appContext.entryPath()));
  }

  // Contraseña correcta pero correo sin verificar: se pide un código nuevo (el
  // del registro puede haber caducado) y se lleva a la pantalla del código
  private async goToVerify(email: string): Promise<void> {
    this.auth.setPendingVerificationEmail(email, false);
    await this.auth.resendVerificationCode(email).catch(rethrowUnlessApiError);
    await this.router.navigateByUrl('/auth/verify');
  }

  // Solo rutas de la propia app («/trips», nunca «//otro-sitio.com»), para que
  // un enlace manipulado no lleve a otra web después del login. Sin ella, la
  // entrada de la cuenta (la app o el panel, ver AppContextService)
  private getSafeReturnUrl(): string | null {
    const url = this.returnUrl();
    return url?.startsWith('/') && !url.startsWith('//') ? url : null;
  }
}
