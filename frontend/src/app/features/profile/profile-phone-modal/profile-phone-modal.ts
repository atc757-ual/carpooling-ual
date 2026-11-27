import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon, IonInput, IonSpinner, IonText, ModalController } from '@ionic/angular';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { checkmarkCircle, shieldCheckmarkOutline, trashOutline } from 'ionicons/icons';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { CodeInput } from '../../../shared/components/ui/code-input/code-input';
import { PhonePrefixSelect } from '../../../shared/components/ui/phone-prefix-select/phone-prefix-select';
import { createCountdown, getResendLabel } from '../../../shared/utils/countdown.util';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { SPANISH_PREFIX } from '../../../shared/utils/phone-prefixes';
import {
  buildPhone,
  formatPhone,
  formatPhoneNumber,
  phoneNumberValidator,
  splitPhone,
} from '../../../shared/utils/phone.util';
import { localizedComputed } from '../../../core/i18n/localized-computed';

const RESEND_WAIT_SECONDS = 60;
const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';

// Ventana para gestionar el teléfono y verificarlo con código SMS
@Component({
  selector: 'app-profile-phone-modal',
  imports: [
    ModalHeader,
    IonicFormStatus,
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonInput,
    IonSpinner,
    IonText,
    PhonePrefixSelect,
    CodeInput,
    TranslocoPipe,
  ],
  templateUrl: './profile-phone-modal.html',
  styleUrl: './profile-phone-modal.scss',
})
export class ProfilePhoneModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() user: User | null = null;
  // Desde «Verificar» de la tarjeta: abre explicando el SMS que se va a enviar,
  // con el número sin editar; el código solo sale al confirmarlo
  @Input() startVerification = false;

  readonly step = signal<'number' | 'remove' | 'confirm' | 'verify'>('number');
  // Solo se vuelve a editar el número si se llegó al código desde él (no al
  // abrirla con «Verificar»)
  readonly canGoBackToNumber = signal(false);
  readonly isSaving = signal(false);
  readonly isVerifying = signal(false);
  readonly isLocked = signal(false);
  readonly isRateLimited = signal(false);

  readonly phoneForm = inject(NonNullableFormBuilder).group({
    phonePrefix: [SPANISH_PREFIX],
    phone: ['', [Validators.required, phoneNumberValidator('phonePrefix')]],
  });

  readonly codeForm = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  private readonly codeInput = viewChild(CodeInput);
  private readonly resendCountdown = createCountdown(RESEND_WAIT_SECONDS, this.destroyRef);
  readonly secondsToResend = this.resendCountdown.seconds;
  readonly resendLabel = localizedComputed(() => getResendLabel(this.secondsToResend()));

  private readonly unlockAfterRateLimit = effect(() => {
    if (this.isRateLimited() && this.secondsToResend() === 0) {
      this.isRateLimited.set(false);
      if (!this.isLocked()) this.codeForm.controls.code.enable();
    }
  });

  protected readonly verifiedIcon = checkmarkCircle;
  protected readonly shieldIcon = shieldCheckmarkOutline;
  protected readonly removeIcon = trashOutline;

  readonly currentUser = computed(() => this.user ?? this.auth.currentUser());
  readonly isVerified = computed(() => Boolean(this.currentUser()?.phoneVerified));
  readonly formattedCurrentPhone = computed(() => {
    const raw = this.currentUser()?.phone;
    return raw ? formatPhone(raw) : null;
  });

  ngOnInit(): void {
    const user = this.currentUser();
    if (user?.phone) {
      const split = splitPhone(user.phone, SPANISH_PREFIX);
      this.phoneForm.patchValue({
        phonePrefix: split.prefix,
        phone: formatPhoneNumber(split.prefix, split.number),
      });
    }

    const { phonePrefix, phone } = this.phoneForm.controls;
    phonePrefix.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((prefix) => {
      phone.setValue(formatPhoneNumber(prefix, phone.value), { emitEvent: false });
      phone.updateValueAndValidity();
    });

    phone.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const split = splitPhone(value, phonePrefix.value);
      const shown = formatPhoneNumber(split.prefix, split.number);
      if (shown !== value) {
        phone.setValue(shown, { emitEvent: false });
      }
      if (split.prefix !== phonePrefix.value) {
        phonePrefix.setValue(split.prefix);
      }
    });

    if (this.startVerification) {
      this.step.set('confirm');
    }
  }

  isPhoneChanged(): boolean {
    const user = this.currentUser();
    const currentNumber = user?.phone ?? '';
    const { phonePrefix, phone } = this.phoneForm.getRawValue();
    const newNumber = buildPhone(phonePrefix, phone);
    return newNumber !== currentNumber;
  }

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  // Guarda el número nuevo (el backend lo deja sin verificar); true si se guardó
  private async savePhone(): Promise<boolean> {
    if (this.phoneForm.invalid || this.isSaving()) {
      return false;
    }
    this.isSaving.set(true);
    const { phonePrefix, phone } = this.phoneForm.getRawValue();
    const fullPhone = buildPhone(phonePrefix, phone);
    try {
      const updated = await this.usersService.updateMe({ phone: fullPhone });
      this.auth.updateUser(updated);
      this.user = updated;
      return true;
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      void this.toast.showError(getErrorMessage(apiError));
      if (apiError.code === 'OTP_SEND_RATE_LIMITED') this.applyRateLimit(apiError);
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  // Todo número se verifica: si ha cambiado, primero se guarda; después, el
  // código por SMS
  async handleStartVerification(isFromNumber = true): Promise<void> {
    if (this.isPhoneChanged() && !(await this.savePhone())) {
      return;
    }
    this.isVerifying.set(true);
    try {
      await this.usersService.requestPhoneVerification();
      this.canGoBackToNumber.set(isFromNumber);
      this.step.set('verify');
      this.resendCountdown.restart();
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      void this.toast.showError(getErrorMessage(apiError));
      if (apiError.code === 'OTP_SEND_RATE_LIMITED') this.applyRateLimit(apiError);
    } finally {
      this.isVerifying.set(false);
    }
  }

  async handleResendCode(): Promise<void> {
    try {
      await this.usersService.requestPhoneVerification();
      this.codeForm.reset();
      this.isLocked.set(false);
      this.resendCountdown.restart();
      void this.toast.showSuccess(translate('screens.profilePhoneModal.nuevoCodigoEnviadoSms'));
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  async handleConfirmCode(): Promise<void> {
    if (this.isLocked() || this.isVerifying() || this.codeForm.invalid) {
      return;
    }
    this.isVerifying.set(true);
    try {
      const updated = await this.usersService.confirmPhoneVerification(
        this.codeForm.getRawValue().code,
      );
      this.auth.updateUser(updated);
      this.user = updated;
      void this.toast.showSuccess(translate('screens.profilePhoneModal.telefonoVerificado'));
      await this.modalController.dismiss(updated, 'saved');
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      void this.toast.showError(getErrorMessage(apiError));
      this.codeForm.reset();
      this.codeInput()?.shake();
      if (apiError.code === TOO_MANY_ATTEMPTS) {
        this.isLocked.set(true);
      } else if (apiError.code === 'OTP_SEND_RATE_LIMITED') {
        this.applyRateLimit(apiError);
      }
    } finally {
      this.isVerifying.set(false);
    }
  }

  private applyRateLimit(error: ApiError): void {
    this.isRateLimited.set(true);
    this.codeForm.controls.code.disable();
    this.resendCountdown.restart(error.retryAfterSeconds ?? 300);
  }

  // Quita el teléfono (es opcional): la API lo deja sin verificar y deja de
  // compartirlo
  async handleRemovePhone(): Promise<void> {
    if (this.isSaving()) {
      return;
    }
    this.isSaving.set(true);
    try {
      const updated = await this.usersService.updateMe({ phone: null });
      this.auth.updateUser(updated);
      this.user = updated;
      void this.toast.showSuccess(translate('profile.phoneModal.removed'));
      await this.modalController.dismiss(updated, 'saved');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
      this.step.set('number');
    } finally {
      this.isSaving.set(false);
    }
  }

  backToNumber(): void {
    this.step.set('number');
    this.codeForm.reset();
  }
}
