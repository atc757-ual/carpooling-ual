import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import {
  checkmarkCircle,
  close,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { CodeInput } from '../../../shared/components/ui/code-input/code-input';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { createCountdown, getResendLabel } from '../../../shared/utils/countdown.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const RESEND_WAIT_SECONDS = 60;

function matchesPassword(confirmation: AbstractControl<string>): ValidationErrors | null {
  const password = confirmation.parent?.get('password')?.value as string | undefined;
  return confirmation.value && confirmation.value !== password ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-profile-password-modal',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonInput,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslocoPipe,
    CodeInput,
    IonicFormStatus,
  ],
  templateUrl: './profile-password-modal.html',
  styleUrl: './profile-password-modal.scss',
})
export class ProfilePasswordModal implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly email = computed(() => this.user()?.email ?? '');

  readonly step = signal<'code' | 'password'>('code');
  readonly isSendingCode = signal(false);
  readonly isVerifyingCode = signal(false);
  readonly isSubmitting = signal(false);
  readonly isPasswordVisible = signal(false);
  readonly isConfirmVisible = signal(false);

  private readonly resendCountdown = createCountdown(RESEND_WAIT_SECONDS, this.destroyRef);
  readonly secondsToResend = this.resendCountdown.seconds;
  readonly resendLabel = computed(() => getResendLabel(this.secondsToResend()));

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
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

  protected readonly closeIcon = close;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly checkmarkIcon = checkmarkCircle;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmation.updateValueAndValidity());
  }

  ngOnInit(): void {
    void this.handleRequestCode();
  }

  async handleRequestCode(): Promise<void> {
    this.isSendingCode.set(true);
    try {
      await this.auth.requestPasswordChangeCode();
      this.resendCountdown.restart();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSendingCode.set(false);
    }
  }

  async handleResendCode(): Promise<void> {
    if (this.secondsToResend() > 0 || this.isSendingCode()) {
      return;
    }
    await this.handleRequestCode();
  }

  async handleVerifyCode(): Promise<void> {
    const code = this.form.controls.code.value;
    if (code.length !== 6) {
      return;
    }
    this.isVerifyingCode.set(true);
    try {
      await this.auth.verifyPasswordChangeCode(code);
      this.step.set('password');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isVerifyingCode.set(false);
    }
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.controls.password.markAsTouched();
      this.form.controls.confirmation.markAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    try {
      const { code, password } = this.form.getRawValue();
      await this.auth.changePassword(code, password);
      void this.toast.showSuccess('Contraseña actualizada.');
      await this.modalController.dismiss(null, 'saved');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  close(): void {
    void this.modalController.dismiss(null, 'cancel');
  }
}
