import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTranslocoTestingSupport } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { LegalModal } from '../../../shared/components/modals/legal-modal/legal-modal';
import { RegisterPage } from './register.page';

const FORM = {
  firstName: '  Mario  ',
  lastName: ' Pérez   Gil ',
  phonePrefix: '+34',
  phone: '612 345 678',
  email: 'mario.perez@ual.es',
  password: 'secreta123',
  acceptedTerms: true,
};

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let page: RegisterPage;
  let showError: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;
  let register: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let createModal: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    showError = vi.fn().mockResolvedValue(undefined);
    showSuccess = vi.fn().mockResolvedValue(undefined);
    register = vi.fn().mockResolvedValue({});
    createModal = vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) });
    TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTranslocoTestingSupport(),
        { provide: ToastService, useValue: { showError, showSuccess } },
        { provide: AuthService, useValue: { register } },
        { provide: ModalController, useValue: { create: createModal } },
      ],
    });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterPage);
    page = fixture.componentInstance;
    await fixture.whenStable();
  });

  async function submit(): Promise<void> {
    await page.handleSubmit();
    await fixture.whenStable();
  }

  it('does not send an invalid form and marks its fields', async () => {
    page.form.setValue({ ...FORM, phone: '512 345 678', password: 'corta', acceptedTerms: false });

    await submit();

    expect(register).not.toHaveBeenCalled();
    expect(page.form.controls.phone.hasError('phone')).toBe(true);
    expect(page.form.controls.password.hasError('minlength')).toBe(true);
    expect(page.isTermsErrorVisible()).toBe(true);
  });

  it('does not call the server with an email from outside the UAL', async () => {
    page.form.setValue({ ...FORM, email: 'mario@gmail.com' });

    await submit();

    expect(register).not.toHaveBeenCalled();
    expect(page.emailErrorKey()).toBe('auth.validation.emailDomain');
  });

  it('creates the account with the phone in international format and goes to verify the email', async () => {
    page.form.setValue(FORM);

    await submit();

    expect(register).toHaveBeenCalledWith({
      firstName: 'Mario',
      lastName: 'Pérez Gil',
      phone: '+34612345678',
      email: 'mario.perez@ual.es',
      password: 'secreta123',
      acceptedTerms: true,
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/verify');
    expect(page.isSubmitting()).toBe(false);
  });

  it('only accepts letters in the name, with a space, hyphen or apostrophe between them', () => {
    const { firstName, lastName } = page.form.controls;
    firstName.setValue('-Mario');
    lastName.setValue('García--López');

    expect(firstName.hasError('personName')).toBe(true);
    expect(page.firstNameErrorKey()).toBe('auth.validation.nameInvalid');
    expect(page.lastNameErrorKey()).toBe('auth.validation.nameInvalid');

    firstName.setValue('Ana-María');
    lastName.setValue("O'Connor de la Fuente");
    expect(firstName.valid).toBe(true);
    expect(lastName.valid).toBe(true);
  });

  it('asks for the name and the surnames, each with its own limit', () => {
    const { firstName, lastName } = page.form.controls;
    firstName.setValue('');
    lastName.setValue('');
    expect(page.firstNameErrorKey()).toBe('auth.validation.firstNameRequired');
    expect(page.lastNameErrorKey()).toBe('auth.validation.lastNameRequired');

    firstName.setValue('a'.repeat(51));
    lastName.setValue('a'.repeat(101));
    expect(page.firstNameErrorKey()).toBe('auth.validation.firstNameLength');
    expect(page.lastNameErrorKey()).toBe('auth.validation.lastNameLength');
  });

  it('does not let type digits or symbols in the name or the surnames', () => {
    page.form.controls.firstName.setValue('Mario_2!');
    page.form.controls.lastName.setValue('Pérez 3');

    expect(page.form.controls.firstName.value).toBe('Mario');
    expect(page.form.controls.lastName.value).toBe('Pérez ');
  });

  it('hides the error of a field while it is being corrected', () => {
    const { phone } = page.form.controls;
    phone.setValue('5');
    phone.markAsTouched();

    phone.setValue('51');

    expect(phone.touched).toBe(false);
  });

  it('keeps only the digits of the number, in groups of three in Spain', () => {
    page.form.controls.phone.setValue('612-34a5678');

    expect(page.form.controls.phone.value).toBe('612 345 678');
  });

  it('shows the number without groups for other countries', () => {
    page.form.controls.phone.setValue('612 345 678');

    page.form.controls.phonePrefix.setValue('+39');

    expect(page.form.controls.phone.value).toBe('612345678');
  });

  it('shows the flag of the chosen country', () => {
    fixture.detectChanges();
    const flag = (): Element | null =>
      (fixture.nativeElement as HTMLElement).querySelector('app-phone-prefix-select .fi');
    expect(flag()?.classList).toContain('fi-es');

    page.form.controls.phonePrefix.setValue('+44');
    fixture.detectChanges();

    expect(flag()?.classList).toContain('fi-gb');
  });

  it('moves the prefix of a pasted international number to the country list', () => {
    page.form.controls.phone.setValue('+39 333 123 4567');

    expect(page.form.controls.phonePrefix.value).toBe('+39');
    expect(page.form.controls.phone.value).toBe('3331234567');
    expect(page.form.controls.phone.valid).toBe(true);
  });

  it('checks the number again with the rules of the chosen country', () => {
    page.form.controls.phone.setValue('3331234567');
    expect(page.form.controls.phone.hasError('phone')).toBe(true);

    page.form.controls.phonePrefix.setValue('+39');

    expect(page.form.controls.phone.valid).toBe(true);
  });

  it('opens the privacy policy in a modal without checking the box', async () => {
    await page.openLegal('privacy');

    expect(createModal).toHaveBeenCalledWith({
      component: LegalModal,
      componentProps: { document: 'privacy' },
      cssClass: 'legal-dialog',
    });
    expect(page.form.controls.acceptedTerms.value).toBe(false);
  });

  it('shows the API error when the email is already registered', async () => {
    register.mockRejectedValue(new ApiError('EMAIL_ALREADY_REGISTERED', 409));
    page.form.setValue(FORM);

    await submit();

    expect(showError).toHaveBeenCalledWith('Ya hay una cuenta con este correo.');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('jumps from the surnames to the phone number, not to its prefix', () => {
    const setFocus = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(page as unknown as { phoneInput: () => unknown }, 'phoneInput').mockReturnValue({
      setFocus,
    });
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    page.handleNameTab(event);

    expect(event.defaultPrevented).toBe(true);
    expect(setFocus).toHaveBeenCalled();
  });
});
