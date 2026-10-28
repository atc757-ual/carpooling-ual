import { Component, computed, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { arrowBackOutline, mailUnreadOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { PasswordResetService } from '../../../core/services/auth/password-reset.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { CodeInput } from '../../../shared/components/ui/code-input/code-input';
import { createCountdown, getResendLabel } from '../../../shared/utils/countdown.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const FORGOT_PASSWORD_PATH = '/auth/forgot-password';
// La API anula el código al tercer intento fallido
const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';
// La API envía como mucho un código por minuto
const RESEND_WAIT_SECONDS = 60;

// Recuperar la contraseña, paso 2: el código de 6 cifras enviado al correo.
// Se comprueba sin gastarlo (la API lo vuelve a pedir con la contraseña
// nueva), para avisar en el momento si es incorrecto
@Component({
  selector: 'app-reset-code',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    AuthLayout,
    CodeInput,
  ],
  templateUrl: './reset-code.page.html',
  styleUrls: ['../auth-form.scss', './reset-code.page.scss'],
})
export class ResetCodePage implements OnInit {
  private readonly passwordReset = inject(PasswordResetService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly email = this.passwordReset.email;
  readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly isSubmitting = signal(false);
  // Tras 3 fallos el código queda anulado: hay que pedir otro
  readonly isLocked = signal(false);
  private readonly codeInput = viewChild(CodeInput);
  private readonly resendCountdown = createCountdown(RESEND_WAIT_SECONDS, inject(DestroyRef));
  readonly secondsToResend = this.resendCountdown.seconds;
  readonly resendLabel = computed(() => getResendLabel(this.secondsToResend()));

  protected readonly backIcon = arrowBackOutline;
  protected readonly mailIcon = mailUnreadOutline;

  ngOnInit(): void {
    // Sin correo (p. ej. al recargar la página) se vuelve a empezar
    if (!this.email()) {
      void this.router.navigateByUrl(FORGOT_PASSWORD_PATH);
      return;
    }
    this.resendCountdown.restart();
  }

  // Lo lanza el propio campo al completar las seis cifras (o Enter)
  async handleSubmit(): Promise<void> {
    if (this.isLocked() || this.isSubmitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    try {
      await this.passwordReset.checkCode(this.form.getRawValue().code);
      await this.router.navigateByUrl('/auth/new-password');
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      void this.toast.showError(getErrorMessage(apiError));
      this.form.reset();
      this.codeInput()?.shake();
      if (apiError.code === TOO_MANY_ATTEMPTS) {
        this.setLocked(true);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleResend(): Promise<void> {
    try {
      await this.passwordReset.resendCode();
      this.form.reset();
      this.setLocked(false);
      this.resendCountdown.restart();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  private setLocked(isLocked: boolean): void {
    this.isLocked.set(isLocked);
    const code = this.form.controls.code;
    const action = isLocked ? 'disable' : 'enable';
    code[action]();
  }
}
