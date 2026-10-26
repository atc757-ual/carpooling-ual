import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
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
  ModalController,
} from '@ionic/angular';
import {
  arrowBackOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { AuthLayout } from '../../../shared/components/layout/auth-layout/auth-layout';
import { EmailSuggestions } from '../../../shared/components/ui/email-suggestions/email-suggestions';
import { PhonePrefixSelect } from '../../../shared/components/ui/phone-prefix-select/phone-prefix-select';
import {
  LegalDocument,
  LegalModal,
} from '../../../shared/components/modals/legal-modal/legal-modal';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  normalizePersonName,
  personNameValidator,
  stripNameSymbols,
} from '../../../shared/utils/person-name.util';
import { SPANISH_PREFIX } from '../../../shared/utils/phone-prefixes';
import {
  buildPhone,
  formatPhoneNumber,
  phoneNumberValidator,
  splitPhone,
} from '../../../shared/utils/phone.util';
import { getUalEmailErrorText, ualEmailValidator } from '../../../shared/utils/ual-email.util';

// Mismos límites que la API (POST /api/auth/register)
const VERIFY_PATH = '/auth/verify';
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
    EmailSuggestions,
    PhonePrefixSelect,
    IonicFormStatus,
  ],
  templateUrl: './register.page.html',
  styleUrls: ['../auth-form.scss', './register.page.scss'],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH), personNameValidator()]],
    // El prefijo del país (España por defecto) y el número, solo con cifras
    phonePrefix: [SPANISH_PREFIX],
    phone: ['', [Validators.required, phoneNumberValidator('phonePrefix')]],
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
  readonly isPasswordVisible = signal(false);

  protected readonly backIcon = arrowBackOutline;
  protected readonly personIcon = personOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly lockIcon = lockClosedOutline;
  protected readonly eyeIcon = eyeOutline;
  protected readonly eyeOffIcon = eyeOffOutline;

  constructor() {
    const { name, phonePrefix, phone, email, password } = this.form.controls;
    // En el nombre no se pueden escribir números ni símbolos
    name.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const cleaned = stripNameSymbols(value);
      if (cleaned !== value) {
        name.setValue(cleaned, { emitEvent: false });
      }
    });
    // Al cambiar de país, el número se muestra y se comprueba con sus reglas
    // (el aviso, al salir del campo)
    phonePrefix.valueChanges.pipe(takeUntilDestroyed()).subscribe((prefix) => {
      phone.setValue(formatPhoneNumber(prefix, phone.value), { emitEvent: false });
      phone.updateValueAndValidity();
      phone.markAsUntouched();
    });
    // En el número solo quedan cifras (en España, en grupos de tres); si se
    // pega uno completo (+39…), su prefijo pasa al desplegable
    phone.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const split = splitPhone(value, phonePrefix.value);
      const shown = formatPhoneNumber(split.prefix, split.number);
      if (shown !== value) {
        phone.setValue(shown, { emitEvent: false });
      }
      if (split.prefix !== phonePrefix.value) {
        phonePrefix.setValue(split.prefix);
      }
    });
    // Mientras se corrige un campo, su aviso de error se quita; vuelve a
    // comprobarse al salir de él (Ionic lo marca como tocado al perder el foco)
    for (const field of [name, phone, email, password]) {
      field.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => field.markAsUntouched());
    }
  }

  nameErrorText(): string {
    return this.form.controls.name.hasError('personName')
      ? 'Usa solo letras; entre palabras, un espacio, un guion o un apóstrofo.'
      : 'Escribe tu nombre y apellidos.';
  }

  emailErrorText(): string {
    return getUalEmailErrorText(this.form.controls.email);
  }

  // Aviso de la casilla de las normas: ion-checkbox no tiene errorText
  isTermsErrorVisible(): boolean {
    const terms = this.form.controls.acceptedTerms;
    return terms.touched && terms.invalid;
  }

  // Abre las condiciones de uso o la política de privacidad sin salir del formulario
  async openLegal(document: LegalDocument): Promise<void> {
    const modal = await this.modalController.create({
      component: LegalModal,
      componentProps: { document },
    });
    await modal.present();
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const { name, phonePrefix, phone, email, password } = this.form.getRawValue();
    try {
      await this.auth.register({
        name: normalizePersonName(name),
        phone: buildPhone(phonePrefix, phone),
        email,
        password,
        acceptedTerms: true,
      });
      // El correo no va en la URL: lo guarda AuthService al registrar
      await this.router.navigateByUrl(VERIFY_PATH);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
