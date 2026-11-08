import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import { LocationConsentService } from '../../../../core/services/location/location-consent.service';
import {
  LocationError,
  LocationService,
} from '../../../../core/services/location/location.service';
import { PushNotificationsService } from '../../../../core/services/push/push-notifications.service';
import { PermissionsModal } from './permissions-modal';

describe('PermissionsModal', () => {
  let fixture: ComponentFixture<PermissionsModal>;
  const enable = vi.fn();
  const getCurrentPoint = vi.fn();
  const setConsent = vi.fn();
  const dismiss = vi.fn().mockResolvedValue(true);

  function render(inputs: Partial<PermissionsModal>): PermissionsModal {
    TestBed.configureTestingModule({
      imports: [PermissionsModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: PushNotificationsService, useValue: { enable } },
        { provide: LocationService, useValue: { getCurrentPoint } },
        { provide: LocationConsentService, useValue: { set: setConsent } },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    fixture = TestBed.createComponent(PermissionsModal);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function rows(): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('.permissions__row').length;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setConsent.mockResolvedValue(undefined);
    getCurrentPoint.mockResolvedValue([-2.4, 36.8]);
  });

  it('shows only what can be asked', () => {
    render({ canAskPush: true, canAskLocation: false });
    expect(rows()).toBe(1);
  });

  it('enables each permission on its own', async () => {
    const modal = render({ canAskPush: true, canAskLocation: true });
    enable.mockResolvedValue(true);

    await modal.handleEnablePush();

    expect(modal.pushState()).toBe('done');
    expect(modal.locationState()).toBe('idle');
    expect(setConsent).not.toHaveBeenCalled();
    expect(modal.isAnswered()).toBe(false);
  });

  it('marks the notifications as blocked when refused or failing', async () => {
    const modal = render({ canAskPush: true });
    enable.mockResolvedValueOnce(false);
    await modal.handleEnablePush();
    expect(modal.pushState()).toBe('blocked');

    enable.mockRejectedValueOnce(new Error('no'));
    await modal.handleEnablePush();
    expect(modal.pushState()).toBe('blocked');
    expect(modal.isAnswered()).toBe(true);
  });

  it('records the consent before asking for the location', async () => {
    const modal = render({ canAskLocation: true });

    await modal.handleEnableLocation();

    expect(setConsent).toHaveBeenCalledWith('granted', 'location_prompt');
    expect(getCurrentPoint).toHaveBeenCalledTimes(1);
    expect(modal.locationState()).toBe('done');
  });

  it('tells a refused location apart from having no signal', async () => {
    const modal = render({ canAskLocation: true });
    getCurrentPoint.mockRejectedValueOnce(new LocationError('denied'));
    await modal.handleEnableLocation();
    expect(modal.locationState()).toBe('blocked');

    getCurrentPoint.mockRejectedValueOnce(new LocationError('unavailable'));
    await modal.handleEnableLocation();
    expect(modal.locationState()).toBe('done');
  });

  it('closes without asking anything else', async () => {
    await render({ canAskPush: true }).handleClose();
    expect(dismiss).toHaveBeenCalledWith(null, 'close');
    expect(enable).not.toHaveBeenCalled();
  });
});
