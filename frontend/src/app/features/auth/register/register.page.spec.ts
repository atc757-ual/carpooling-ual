import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LegalModal } from '../../../shared/components/modals/legal-modal/legal-modal';
import { RegisterPage } from './register.page';

const FORM = {
  name: '  Mario Pérez ',
  phone: '612 345 678',
  email: 'mario.perez@ual.es',
  password: 'secreta123',
  acceptedTerms: true,
};

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let page: RegisterPage;
  let register: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let createModal: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    register = vi.fn().mockResolvedValue({});
    createModal = vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) });
    TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
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

  function shownError(): string | undefined {
    return (fixture.nativeElement as HTMLElement).querySelector('.auth-error')?.textContent?.trim();
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
    expect(page.emailErrorText()).toBe('Usa tu correo de la Universidad de Almería.');
  });

  it('creates the account with the phone in international format and goes to verify the email', async () => {
    page.form.setValue(FORM);

    await submit();

    expect(register).toHaveBeenCalledWith({
      name: 'Mario Pérez',
      phone: '+34612345678',
      email: 'mario.perez@ual.es',
      password: 'secreta123',
      acceptedTerms: true,
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/verify');
    expect(page.isSubmitting()).toBe(false);
  });

  it('opens the privacy policy in a modal without checking the box', async () => {
    await page.openLegal('privacy');

    expect(createModal).toHaveBeenCalledWith({
      component: LegalModal,
      componentProps: { document: 'privacy' },
    });
    expect(page.form.controls.acceptedTerms.value).toBe(false);
  });

  it('shows the API error when the email is already registered', async () => {
    register.mockRejectedValue(new ApiError('EMAIL_ALREADY_REGISTERED', 409));
    page.form.setValue(FORM);

    await submit();

    expect(shownError()).toBe('Ya hay una cuenta con este correo.');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
