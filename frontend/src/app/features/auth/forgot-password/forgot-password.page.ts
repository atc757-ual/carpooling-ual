import { Component, inject, signal } from '@angular/core';
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
import { arrowBackOutline, mailOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { PasswordResetService } from '../../../core/services/auth/password-reset.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { Combobox } from '../../../shared/components/ui/combobox/combobox';
import { EmailSuggestions } from '../../../shared/components/ui/email-suggestions/email-suggestions';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getUalEmailErrorText, ualEmailValidator } from '../../../shared/utils/ual-email.util';

// Recuperar la contraseña, paso 1 (diseño 06): el correo al que enviar el
// código. Después, la pantalla del código (reset-code)
@Component({
  selector: 'app-forgot-password',
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
  ],
  templateUrl: './forgot-password.page.html',
  styleUrls: ['../auth-form.scss', './forgot-password.page.scss'],
})
export class ForgotPasswordPage {
  private readonly passwordReset = inject(PasswordResetService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly form = inject(NonNullableFormBuilder).group({
    // Con el dominio también aquí: un correo de fuera no llega al servidor
    email: [
      this.passwordReset.email(),
      [Validators.required, Validators.email, ualEmailValidator()],
    ],
  });
  readonly isSubmitting = signal(false);

  protected readonly backIcon = arrowBackOutline;
  protected readonly mailIcon = mailOutline;

  emailErrorText(): string {
    return getUalEmailErrorText(this.form.controls.email);
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    try {
      await this.passwordReset.requestCode(this.form.getRawValue().email);
      await this.router.navigateByUrl('/auth/reset-code');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
