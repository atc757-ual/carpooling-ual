import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileDeviceLocation } from './profile-device-location';

describe('ProfileDeviceLocation', () => {
  let fixture: ComponentFixture<ProfileDeviceLocation>;
  let component: ProfileDeviceLocation;
  const location = {
    checkDevicePermission: vi.fn(),
    requestDevicePermission: vi.fn(),
  };
  const toast = {
    showSuccess: vi.fn().mockResolvedValue(undefined),
    showError: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    location.checkDevicePermission.mockResolvedValue('granted');
    TestBed.configureTestingModule({
      imports: [ProfileDeviceLocation],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: LocationService, useValue: location },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(ProfileDeviceLocation);
    component = fixture.componentInstance;
  });

  it('shows granted status and hint when device permission is granted', async () => {
    await component.refresh();
    fixture.detectChanges();
    expect(component.devicePermission()).toBe('granted');
    expect(component.hintKey()).toBe('profile.location.deviceGrantedDesc');
    const badge = fixture.nativeElement.querySelector('.status--accepted');
    expect(badge).not.toBeNull();
  });

  it('shows prompt and allows requesting permission through form submit', async () => {
    location.checkDevicePermission.mockResolvedValueOnce('prompt');
    location.requestDevicePermission.mockResolvedValue('granted');

    await component.refresh();
    fixture.detectChanges();
    expect(component.devicePermission()).toBe('prompt');
    expect(component.hintKey()).toBe('profile.location.devicePromptDesc');

    const form = fixture.nativeElement.querySelector('form');
    expect(form).not.toBeNull();
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(location.requestDevicePermission).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalledWith('Ubicación del dispositivo permitida.');
    expect(component.devicePermission()).toBe('granted');
  });

  it('handles denial gracefully', async () => {
    location.checkDevicePermission.mockResolvedValue('denied');
    await component.refresh();
    fixture.detectChanges();
    expect(component.devicePermission()).toBe('denied');
    expect(component.hintKey()).toBe('profile.location.deviceDeniedDesc');
    const badge = fixture.nativeElement.querySelector('.status--pending');
    expect(badge).not.toBeNull();
  });

  it('explains with a toast why the permission could not be given', async () => {
    location.checkDevicePermission.mockResolvedValueOnce('prompt').mockResolvedValueOnce('denied');
    location.requestDevicePermission.mockRejectedValue(new LocationError('denied'));

    await component.refresh();
    await component.handleAllowDevice();

    expect(component.devicePermission()).toBe('denied');
    expect(component.isAsking()).toBe(false);
    expect(toast.showSuccess).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalledWith(
      'Has bloqueado la ubicación. Actívala en los ajustes del navegador o del móvil.',
    );
  });

  it('rethrows unexpected errors', async () => {
    location.requestDevicePermission.mockRejectedValue(new Error('boom'));

    await expect(component.handleAllowDevice()).rejects.toThrow('boom');
    expect(component.isAsking()).toBe(false);
    expect(toast.showError).not.toHaveBeenCalled();
  });

  it('does not show toast if permission check does not result in granted', async () => {
    location.checkDevicePermission.mockResolvedValueOnce('prompt');
    location.requestDevicePermission.mockResolvedValue('prompt');

    await component.refresh();
    await component.handleAllowDevice();

    expect(toast.showSuccess).not.toHaveBeenCalled();
    expect(component.devicePermission()).toBe('prompt');
  });
});
