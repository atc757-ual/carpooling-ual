import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { alertCircleOutline, mailOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { CodeInput } from '../../../shared/components/ui/code-input/code-input';
import { createCountdown, formatMinutesSeconds } from '../../../shared/utils/countdown.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

// La espera para reenviar es la del backend (RESEND_COOLDOWN_SECONDS)
const RESEND_WAIT_SECONDS = 60;
const CODE_LENGTH = 6;

// Confirmar la identidad con un código de 6 dígitos al correo, igual al
// cambiar la contraseña y al eliminar la cuenta: 1) para qué es el código y
// «Enviar código»; 2) el código, que se comprueba solo al completarlo, con
// «Reenviar código» tras 60 s. Avisa con «verified» y el código correcto: el
// modal lo usa en su último paso (el código no se gasta al comprobarlo)
@Component({
  selector: 'app-identity-check',
  imports: [ReactiveFormsModule, IonButton, IonIcon, IonSpinner, TranslocoPipe, CodeInput],
  templateUrl: './identity-check.html',
  styleUrl: './identity-check.scss',
})
export class IdentityCheck {
  // Opcional: condiciones que hay que cumplir (tarjeta gris bajo el aviso),
  // con su título y una clave de traducción por condición
  readonly requirementsTitleKey = input<string | null>(null);
  readonly requirementKeys = input<readonly string[]>([]);
  readonly requestCode = input.required<() => Promise<void>>();
  readonly verifyCode = input.required<(code: string) => Promise<void>>();
  readonly verified = output<string>();

  readonly step = signal<'request' | 'code'>('request');
  readonly errorMessage = signal<string | null>(null);
  readonly isSending = signal(false);
  readonly isVerifying = signal(false);
  // Tras demasiados fallos el backend anula el código: hay que pedir otro
  readonly needsNewCode = signal(false);

  private readonly countdown = createCountdown(RESEND_WAIT_SECONDS, inject(DestroyRef), 0);
  readonly secondsToResend = this.countdown.seconds;
  readonly resendTime = computed(() => formatMinutesSeconds(this.secondsToResend()));

  readonly code = inject(NonNullableFormBuilder).control('', [
    Validators.required,
    Validators.minLength(CODE_LENGTH),
    Validators.maxLength(CODE_LENGTH),
  ]);

  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly alertIcon = alertCircleOutline;

  constructor() {
    // Al corregir el código, el error anterior sobra
    this.code.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (!this.needsNewCode()) {
        this.errorMessage.set(null);
      }
    });
  }

  async handleSendCode(): Promise<void> {
    if (this.isSending() || this.secondsToResend() > 0) {
      return;
    }
    this.errorMessage.set(null);
    this.isSending.set(true);
    try {
      await this.requestCode()();
      this.code.reset();
      this.needsNewCode.set(false);
      this.countdown.restart();
      this.step.set('code');
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSending.set(false);
    }
  }

  async handleVerify(): Promise<void> {
    const code = this.code.value;
    if (this.code.invalid || this.isVerifying() || this.needsNewCode()) {
      return;
    }
    this.errorMessage.set(null);
    this.isVerifying.set(true);
    try {
      await this.verifyCode()(code);
      this.verified.emit(code);
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      this.errorMessage.set(getErrorMessage(apiError));
      if (apiError.code === 'TOO_MANY_ATTEMPTS') {
        this.needsNewCode.set(true);
        this.code.reset();
        this.secondsToResend.set(0);
      }
    } finally {
      this.isVerifying.set(false);
    }
  }
}
