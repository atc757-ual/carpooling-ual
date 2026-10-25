import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInputOtp,
  IonRouterLink,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { arrowBackOutline, mailUnreadOutline } from 'ionicons/icons';
import { MODES_PATH } from '../../../core/guards/redirect-paths';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const CODE_LENGTH = 6;
// La API envía como mucho un código por minuto
const RESEND_WAIT_SECONDS = 60;
// Minutos que vale un código (los mismos que en la API)
const CODE_TTL_MINUTES = 15;

// Verificar el correo con el código de 6 cifras que se envía al registrarse
// (o al entrar sin haberlo verificado). Si es correcto, la API abre la sesión.
// El correo lo deja AuthService al registrar o al entrar sin verificar
@Component({
  selector: 'app-verify',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInputOtp,
    IonRouterLink,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    AuthLayout,
    IonicFormStatus,
  ],
  templateUrl: './verify.page.html',
  styleUrls: ['../auth-form.scss', './verify.page.scss'],
})
export class VerifyPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // El correo pendiente de verificar (lo guarda AuthService al registrar o al
  // entrar sin haberlo verificado); nunca en la URL
  readonly email = signal('');

  readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasResent = signal(false);
  readonly secondsToResend = signal(RESEND_WAIT_SECONDS);
  readonly resendLabel = computed(() => {
    const seconds = this.secondsToResend();
    return seconds > 0
      ? `Reenviar código en 00:${String(seconds).padStart(2, '0')}`
      : 'Reenviar código';
  });

  protected readonly codeLength = CODE_LENGTH;
  protected readonly verificationTimeout = CODE_TTL_MINUTES;
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
    this.startResendCountdown();
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.verifyEmail({ email: this.email(), code: this.form.getRawValue().code });
      await this.router.navigateByUrl(MODES_PATH);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
      this.form.reset();
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async handleResend(): Promise<void> {
    this.errorMessage.set(null);
    try {
      await this.auth.resendVerificationCode(this.email());
      this.hasResent.set(true);
      this.form.reset();
      this.startResendCountdown();
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  // Cuenta atrás hasta poder pedir otro código
  private startResendCountdown(): void {
    this.secondsToResend.set(RESEND_WAIT_SECONDS);
    const timer = setInterval(() => {
      this.secondsToResend.update((seconds) => seconds - 1);
      if (this.secondsToResend() <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }
}
