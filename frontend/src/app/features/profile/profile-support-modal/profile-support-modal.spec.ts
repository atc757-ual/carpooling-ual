import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { SupportService } from '../../../core/services/support/support.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileSupportModal } from './profile-support-modal';

const MESSAGE = 'El conductor no ha llegado al punto de recogida.';

describe('ProfileSupportModal', () => {
  let fixture: ComponentFixture<ProfileSupportModal>;
  let component: ProfileSupportModal;
  let sendMessage: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue(undefined);
    dismiss = vi.fn().mockResolvedValue(true);
    showSuccess = vi.fn();
    TestBed.configureTestingModule({
      imports: [ProfileSupportModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: SupportService, useValue: { sendMessage } },
        { provide: ModalController, useValue: { dismiss } },
        { provide: ToastService, useValue: { showSuccess, showError: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ProfileSupportModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('offers the five topics as one-tap options', () => {
    const root = fixture.nativeElement as HTMLElement;
    const options = root.querySelectorAll<HTMLInputElement>('input[formControlName="topic"]');

    options[2].click();

    expect(options).toHaveLength(5);
    expect(component.form.controls.topic.value).toBe('bug');
  });

  it('needs a topic and between 20 and 1000 characters', async () => {
    component.form.setValue({ topic: '', message: MESSAGE });
    expect(component.form.valid).toBe(false);
    component.form.setValue({ topic: 'trip', message: 'Muy corto' });
    expect(component.form.valid).toBe(false);
    component.form.setValue({ topic: 'trip', message: 'a'.repeat(1001) });
    expect(component.form.valid).toBe(false);

    await component.handleSubmit();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends the trimmed message, says so and closes', async () => {
    component.form.setValue({ topic: 'trip', message: `  ${MESSAGE}  ` });

    await component.handleSubmit();

    expect(sendMessage).toHaveBeenCalledWith('trip', MESSAGE);
    expect(showSuccess).toHaveBeenCalledWith('profile.supportModal.sent');
    expect(dismiss).toHaveBeenCalledWith(null, 'sent');
    expect(component.isSending()).toBe(false);
  });

  it('keeps the message and shows the error when sending fails', async () => {
    sendMessage.mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', 503));
    component.form.setValue({ topic: 'account', message: MESSAGE });

    await component.handleSubmit();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.form.controls.message.value).toBe(MESSAGE);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('closes without sending', () => {
    component.close();

    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
