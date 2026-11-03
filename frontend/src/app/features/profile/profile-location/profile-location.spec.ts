import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ConsentRecord, UserConsents } from '../../../core/models/user-consent.model';
import { LocationConsentService } from '../../../core/services/location/location-consent.service';
import { LocationService } from '../../../core/services/location/location.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileLocation } from './profile-location';

function consents(action: 'granted' | 'revoked' | null): UserConsents {
  const location: ConsentRecord | null = action && {
    id: 'c1',
    type: 'location',
    documentVersion: '1.0',
    action,
    source: 'settings',
    recordedAt: '2026-10-31T10:00:00.000Z',
    fingerprint: 'a1b2c3d4e5f6',
  };
  return {
    current: { terms: null, privacy: null, location, driverDeclaration: null },
    history: [],
  };
}

function toggleEvent(checked: boolean): CustomEvent<{ checked: boolean }> & {
  target: { checked: boolean };
} {
  const target = { checked };
  return { detail: { checked }, target } as unknown as CustomEvent<{ checked: boolean }> & {
    target: { checked: boolean };
  };
}

describe('ProfileLocation', () => {
  let fixture: ComponentFixture<ProfileLocation>;
  const consent = { load: vi.fn(), set: vi.fn() };
  const location = {
    checkDevicePermission: vi.fn(),
    recordDeviceWithdrawal: vi.fn().mockResolvedValue(undefined),
    getCurrentPoint: vi.fn(),
  };
  const confirm = { ask: vi.fn() };
  const toast = {
    showSuccess: vi.fn().mockResolvedValue(undefined),
    showError: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consent.load.mockResolvedValue(consents('granted'));
    location.checkDevicePermission.mockResolvedValue('granted');
    TestBed.configureTestingModule({
      imports: [ProfileLocation],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: LocationConsentService, useValue: consent },
        { provide: LocationService, useValue: location },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ProfileLocation);
  });

  it('shows the consent with its stamp and the device permission', async () => {
    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.isGranted()).toBe(true);
    expect(fixture.componentInstance.stamp()).not.toBeNull();
    expect(fixture.componentInstance.devicePermission()).toBe('granted');
    expect(location.recordDeviceWithdrawal).not.toHaveBeenCalled();
  });

  it('records the withdrawal when the device permission was removed', async () => {
    location.checkDevicePermission.mockResolvedValue('denied');
    consent.load
      .mockResolvedValueOnce(consents('granted'))
      .mockResolvedValueOnce(consents('revoked'));

    await fixture.componentInstance.refresh();

    expect(location.recordDeviceWithdrawal).toHaveBeenCalled();
    expect(fixture.componentInstance.isGranted()).toBe(false);
  });

  it('grants the consent with the toggle', async () => {
    consent.set.mockResolvedValue(consents('granted'));

    await fixture.componentInstance.handleToggle(toggleEvent(true));

    expect(consent.set).toHaveBeenCalledWith('granted');
    expect(toast.showSuccess).toHaveBeenCalledWith('Compartes tu ubicación.');
  });

  it('keeps sharing when the revocation is not confirmed', async () => {
    confirm.ask.mockResolvedValue(false);
    const event = toggleEvent(false);

    await fixture.componentInstance.handleToggle(event);

    expect(consent.set).not.toHaveBeenCalled();
    expect(event.target.checked).toBe(true);
  });

  it('revokes after confirming and undoes the toggle if saving fails', async () => {
    confirm.ask.mockResolvedValue(true);
    consent.set.mockResolvedValueOnce(consents('revoked')).mockRejectedValueOnce(new Error());

    await fixture.componentInstance.handleToggle(toggleEvent(false));
    expect(toast.showSuccess).toHaveBeenCalledWith('Has dejado de compartir tu ubicación.');

    const failing = toggleEvent(false);
    await fixture.componentInstance.handleToggle(failing);
    expect(failing.target.checked).toBe(true);
    expect(toast.showError).toHaveBeenCalled();
  });

  it('asks the device for the location and reads the new permission', async () => {
    location.getCurrentPoint.mockRejectedValue(new Error('denied'));
    location.checkDevicePermission.mockResolvedValue('prompt');

    await fixture.componentInstance.handleAllowDevice();

    expect(fixture.componentInstance.devicePermission()).toBe('prompt');
    expect(fixture.componentInstance.isAsking()).toBe(false);
  });

  it('renders without errors', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement).toBeTruthy();
  });
});
