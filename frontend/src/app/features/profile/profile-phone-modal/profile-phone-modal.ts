import {
  Component,
  computed,
  DestroyRef,
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
import { checkmarkCircle, shieldCheckmarkOutline } from 'ionicons/icons';
import { TranslocoPipe } from '@jsverse/transloco';
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
  // Desde «Verificar» de la tarjeta: envía el código y abre en ese paso
  @Input() startVerification = false;

  readonly step = signal<'number' | 'verify'>('number');
  readonly isSaving = signal(false);
  readonly isVerifying = signal(false);
  readonly isLocked = signal(false);

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
  readonly resendLabel = computed(() => getResendLabel(this.secondsToResend()));

  protected readonly verifiedIcon = checkmarkCircle;
  protected readonly shieldIcon = shieldCheckmarkOutline;

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
      void this.handleStartVerification();
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
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
      return false;
    } finally {
      this.isSaving.set(false);
    }
  }

  // Todo número se verifica: si ha cambiado, primero se guarda; después, el
  // código por SMS
  async handleStartVerification(): Promise<void> {
    if (this.isPhoneChanged() && !(await this.savePhone())) {
      return;
    }
    this.isVerifying.set(true);
    try {
      await this.usersService.requestPhoneVerification();
      this.step.set('verify');
      this.resendCountdown.restart();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
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
      void this.toast.showSuccess('Nuevo código enviado por SMS.');
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
      void this.toast.showSuccess('Teléfono verificado.');
      await this.modalController.dismiss(updated, 'saved');
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      void this.toast.showError(getErrorMessage(apiError));
      this.codeForm.reset();
      this.codeInput()?.shake();
      if (apiError.code === TOO_MANY_ATTEMPTS) {
        this.isLocked.set(true);
      }
    } finally {
      this.isVerifying.set(false);
    }
  }

  backToNumber(): void {
    this.step.set('number');
    this.codeForm.reset();
  }
}
