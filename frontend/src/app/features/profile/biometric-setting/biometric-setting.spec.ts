import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { BiometricLoginService } from '../../../core/services/auth/biometric-login.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { BiometricSetting } from './biometric-setting';

describe('BiometricSetting', () => {
  let fixture: ComponentFixture<BiometricSetting>;
  const isAvailable = signal(false);
  const enabledEmail = signal<string | null>(null);
  const disable = vi.fn().mockResolvedValue(undefined);
  const load = vi.fn().mockResolvedValue(undefined);
  const ask = vi.fn();
  const showSuccess = vi.fn();

  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [BiometricSetting],
      providers: [
        provideIonicAngular(),
        provideAppTransloco(),
        {
          provide: BiometricLoginService,
          useValue: {
            load,
            disable,
            isAvailable,
            enabledEmail,
            isEnabled: () => enabledEmail() !== null,
          },
        },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ToastService, useValue: { showSuccess } },
      ],
    });
    fixture = TestBed.createComponent(BiometricSetting);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    isAvailable.set(false);
    enabledEmail.set(null);
  });

  it('is hidden without biometrics (the web)', async () => {
    const root = await render();

    expect(load).toHaveBeenCalled();
    expect(root.querySelector('ion-item')).toBeNull();
  });

  it('says how to turn it on when it is off', async () => {
    isAvailable.set(true);
    const root = await render();

    expect(root.textContent).toContain('Se ofrece al entrar con tu contraseña');
    expect(root.querySelector('ion-button')).toBeNull();
  });

  it('turns it off after confirming', async () => {
    isAvailable.set(true);
    enabledEmail.set('ana@ual.es');
    const root = await render();
    expect(root.textContent).toContain('ana@ual.es');

    ask.mockResolvedValueOnce(false);
    await fixture.componentInstance.handleDisable();
    expect(disable).not.toHaveBeenCalled();

    ask.mockResolvedValueOnce(true);
    await fixture.componentInstance.handleDisable();
    expect(disable).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith('Huella desactivada.');
  });
});
