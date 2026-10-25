import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonRouterLink,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  arrowBackOutline,
  callOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { normalizePhone, phoneValidator } from '../../../shared/utils/phone.util';
import { getUalEmailErrorText, ualEmailValidator } from '../../../shared/utils/ual-email.util';

// Mismos límites que la API (POST /api/auth/register)
const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

// Crear la cuenta (RF-01, RF-27) con el correo de la UAL, el teléfono y la
// aceptación de las normas. El registro no abre la sesión: después se
// verifica el correo con el código que se envía (/auth/verify)
@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonRouterLink,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    AuthLayout,
    IonicFormStatus,
  ],
  templateUrl: './register.page.html',
  styleUrls: ['../auth-form.scss', './register.page.scss'],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
    phone: ['', [Validators.required, phoneValidator()]],
    email: ['', [Validators.required, Validators.email, ualEmailValidator()]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
        Validators.maxLength(PASSWORD_MAX_LENGTH),
      ],
    ],
    acceptedTerms: [false, Validators.requiredTrue],
  });
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isPasswordVisible = signal(false);

  protected readonly backIcon = arrowBackOutline;
  protected readonly personIcon = personOutline;
  protected readonly phoneIcon = callOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;

  emailErrorText(): string {
    return getUalEmailErrorText(this.form.controls.email);
  }

  // Aviso de la casilla de las normas: ion-checkbox no tiene errorText
  isTermsErrorVisible(): boolean {
    const terms = this.form.controls.acceptedTerms;
    return terms.touched && terms.invalid;
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const { name, phone, email, password } = this.form.getRawValue();
    try {
      await this.auth.register({
        name: name.trim(),
        phone: normalizePhone(phone),
        email,
        password,
        acceptedTerms: true,
      });
      await this.router.navigate(['/auth/verify'], { queryParams: { email } });
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
