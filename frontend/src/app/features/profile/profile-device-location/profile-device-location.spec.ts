import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { LocationService } from '../../../core/services/location/location.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfileDeviceLocation } from './profile-device-location';

describe('ProfileDeviceLocation', () => {
  let fixture: ComponentFixture<ProfileDeviceLocation>;
  let component: ProfileDeviceLocation;
  const location = {
    checkDevicePermission: vi.fn(),
    getCurrentPoint: vi.fn(),
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
    expect(component.devicePermission()).toBe('granted');
    expect(component.hintKey()).toBe('profile.location.deviceGrantedDesc');
  });

  it('shows prompt and allows requesting permission', async () => {
    location.checkDevicePermission.mockResolvedValueOnce('prompt').mockResolvedValueOnce('granted');
    location.getCurrentPoint.mockResolvedValue({ lat: 36.8, lng: -2.4 });

    await component.refresh();
    expect(component.devicePermission()).toBe('prompt');
    expect(component.hintKey()).toBe('profile.location.devicePromptDesc');

    await component.handleAllowDevice();
    expect(location.getCurrentPoint).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalledWith('Ubicación del dispositivo permitida.');
    expect(component.devicePermission()).toBe('granted');
  });

  it('handles denial gracefully', async () => {
    location.checkDevicePermission.mockResolvedValue('denied');
    await component.refresh();
    expect(component.devicePermission()).toBe('denied');
    expect(component.hintKey()).toBe('profile.location.deviceDeniedDesc');
  });
});
