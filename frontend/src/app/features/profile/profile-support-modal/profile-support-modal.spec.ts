import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { SupportService } from '../../../core/services/support/support.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileSupportModal } from './profile-support-modal';

const MESSAGE = 'El conductor no ha llegado al punto de recogida.';

// Un viaje que conduce y otro en el que pidió plaza
const DRIVEN = {
  id: 't1',
  code: 'VJ-0007',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL',
  departureAt: '2026-11-18T07:30:00.000Z',
};
const RIDDEN = { ...DRIVEN, id: 't2', code: 'VJ-0009', departureAt: '2026-11-20T07:30:00.000Z' };

describe('ProfileSupportModal', () => {
  let fixture: ComponentFixture<ProfileSupportModal>;
  let component: ProfileSupportModal;
  let sendMessage: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;
  let listMyTripEntries: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue(undefined);
    dismiss = vi.fn().mockResolvedValue(true);
    showSuccess = vi.fn();
    listMyTripEntries = vi.fn((tab: string) =>
      Promise.resolve(
        tab === 'past'
          ? {
              items: [
                { role: 'driver', trip: DRIVEN },
                { role: 'passenger', request: { trip: { id: 't2' } } },
              ],
              total: 2,
            }
          : { items: [], total: 0 },
      ),
    );
    TestBed.configureTestingModule({
      imports: [ProfileSupportModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: SupportService, useValue: { sendMessage } },
        {
          provide: TripsService,
          useValue: { listMyTripEntries, getTrip: vi.fn().mockResolvedValue(RIDDEN) },
        },
        { provide: ModalController, useValue: { dismiss } },
        { provide: ToastService, useValue: { showSuccess, showError: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ProfileSupportModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only the form, without frequent questions', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-faq-card')).toBeNull();
    expect(root.querySelector('fieldset')).not.toBeNull();
  });

  it('offers the five topics as one-tap options', () => {
    const root = fixture.nativeElement as HTMLElement;
    const options = root.querySelectorAll<HTMLInputElement>('input[formControlName="topic"]');

    options[2].click();

    expect(options).toHaveLength(5);
    expect(component.form.controls.topic.value).toBe('bug');
  });

  it('needs a topic and between 20 and 1000 characters', async () => {
    component.form.patchValue({ topic: '', message: MESSAGE });
    expect(component.form.valid).toBe(false);
    component.form.patchValue({ topic: 'trip', message: 'Muy corto' });
    expect(component.form.valid).toBe(false);
    component.form.patchValue({ topic: 'trip', message: 'a'.repeat(1001) });
    expect(component.form.valid).toBe(false);

    await component.handleSubmit();

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends the trimmed message, says so and closes', async () => {
    component.form.patchValue({ topic: 'trip', message: `  ${MESSAGE}  ` });

    await component.handleSubmit();

    expect(sendMessage).toHaveBeenCalledWith('trip', MESSAGE, undefined);
    expect(showSuccess).toHaveBeenCalledWith(
      'Hemos recibido tu mensaje. Te responderemos por correo.',
    );
    expect(dismiss).toHaveBeenCalledWith(null, 'sent');
    expect(component.isSending()).toBe(false);
  });

  it('keeps the message and shows the error when sending fails', async () => {
    sendMessage.mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', 503));
    component.form.patchValue({ topic: 'account', message: MESSAGE });

    await component.handleSubmit();

    expect(component.errorMessage()).toBeTruthy();
    expect(component.form.controls.message.value).toBe(MESSAGE);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('asks which trip only with the trip topic, newest first, and sends it', async () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ion-select')).toBeNull();
    expect(listMyTripEntries).not.toHaveBeenCalled();

    component.form.patchValue({ topic: 'trip', message: MESSAGE });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const labels = (component.tripOptions.value() ?? []).map(({ label }) => label);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^VJ-0009 · Roquetas de Mar → Campus UAL · /);
    expect(root.querySelectorAll('ion-select-option')).toHaveLength(3);

    component.form.patchValue({ tripId: 't2' });
    await component.handleSubmit();

    expect(sendMessage).toHaveBeenCalledWith('trip', MESSAGE, 't2');
  });

  it('closes without sending', () => {
    component.close();

    expect(dismiss).toHaveBeenCalledWith(null, 'cancel');
  });
});
