import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { alertCircleOutline, close, mailOutline, warningOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { CodeInput } from '../../../shared/components/ui/code-input/code-input';
import { createCountdown, getResendLabel } from '../../../shared/utils/countdown.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const RESEND_WAIT_SECONDS = 60;

@Component({
  selector: 'app-profile-delete-modal',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonButtons,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslocoPipe,
    CodeInput,
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
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly email = computed(() => this.user()?.email ?? '');

  readonly codeSent = signal(false);
  readonly isSendingCode = signal(false);
  readonly isConfirming = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly resendCountdown = createCountdown(RESEND_WAIT_SECONDS, this.destroyRef);
  readonly secondsToResend = this.resendCountdown.seconds;
  readonly resendLabel = computed(() => getResendLabel(this.secondsToResend()));

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
  });

  protected readonly closeIcon = close;
  protected readonly warningIcon = warningOutline;
  protected readonly alertIcon = alertCircleOutline;
  protected readonly mailIcon = mailOutline;

  async handleRequestCode(): Promise<void> {
    this.isSendingCode.set(true);
    this.errorMessage.set(null);
    try {
      await this.usersService.requestAccountDeletion();
      this.codeSent.set(true);
      this.resendCountdown.restart();
    } catch (error) {
      const msg = getErrorMessage(ApiError.fromHttpError(error));
      this.errorMessage.set(msg);
      void this.toast.showError(msg);
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

  async handleConfirmDeletion(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isConfirming.set(true);
    this.errorMessage.set(null);
    try {
      const { code } = this.form.getRawValue();
      await this.usersService.confirmAccountDeletion(code);
      await this.modalController.dismiss(null, 'deleted');
      await this.auth.logout();
      await this.router.navigateByUrl('/auth/welcome');
      void this.toast.showSuccess('Cuenta eliminada.');
    } catch (error) {
      const msg = getErrorMessage(ApiError.fromHttpError(error));
      this.errorMessage.set(msg);
      void this.toast.showError(msg);
    } finally {
      this.isConfirming.set(false);
    }
  }

  close(): void {
    void this.modalController.dismiss(null, 'cancel');
  }
}
