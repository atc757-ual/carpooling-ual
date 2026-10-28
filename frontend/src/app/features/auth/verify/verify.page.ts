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
import { HOME_PATH } from '../../../core/guards/redirect-paths';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { CodeInput } from '../../../shared/components/ui/code-input/code-input';
import { createCountdown, getResendLabel } from '../../../shared/utils/countdown.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

// La API anula el código al tercer intento fallido
const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';
// La API envía como mucho un código por minuto
const RESEND_WAIT_SECONDS = 60;

// Verificar el correo con el código de 6 cifras que se envía al registrarse
// (o al entrar sin haberlo verificado). Si es correcto, la API abre la sesión.
// El correo lo deja AuthService al registrar o al entrar sin verificar
@Component({
  selector: 'app-verify',
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
  templateUrl: './verify.page.html',
  styleUrls: ['../auth-form.scss', './verify.page.scss'],
})
export class VerifyPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // El correo pendiente de verificar (lo guarda AuthService al registrar o al
  // entrar sin haberlo verificado); nunca en la URL
  readonly email = signal('');

  readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly isSubmitting = signal(false);
  readonly hasResent = signal(false);
  // Tras 3 fallos el código queda anulado: no se puede escribir otro hasta
  // pedir uno nuevo
  readonly isLocked = signal(false);
  private readonly codeInput = viewChild(CodeInput);
  private readonly resendCountdown = createCountdown(RESEND_WAIT_SECONDS, inject(DestroyRef));
  readonly secondsToResend = this.resendCountdown.seconds;
  readonly resendLabel = computed(() => getResendLabel(this.secondsToResend()));

  protected readonly backIcon = arrowBackOutline;
  protected readonly mailIcon = mailUnreadOutline;

  ngOnInit(): void {
    const email = this.auth.getPendingVerificationEmail();
    // Sin correo pendiente no hay nada que verificar: se vuelve al login
    if (!email) {
      void this.router.navigateByUrl('/auth/login');
      return;
    }
    this.email.set(email);
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
      await this.auth.verifyEmail({ email: this.email(), code: this.form.getRawValue().code });
      void this.toast.showSuccess('Correo UAL verificado.');
      await this.router.navigateByUrl(HOME_PATH);
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      void this.toast.showError(getErrorMessage(apiError));
      this.form.reset();
      this.codeInput()?.shake();
      if (apiError.code === TOO_MANY_ATTEMPTS) {
        this.lock();
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleResend(): Promise<void> {
    try {
      await this.auth.resendVerificationCode(this.email());
      this.hasResent.set(true);
      this.form.reset();
      this.unlock();
      this.resendCountdown.restart();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  private lock(): void {
    this.isLocked.set(true);
    this.form.controls.code.disable();
  }

  private unlock(): void {
    this.isLocked.set(false);
    this.form.controls.code.enable();
  }
}
