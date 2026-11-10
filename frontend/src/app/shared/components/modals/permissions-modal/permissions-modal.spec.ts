import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import {
  LocationError,
  LocationService,
} from '../../../../core/services/location/location.service';
import { LegalDocumentsService } from '../../../../core/services/users/legal-documents.service';
import { PushNotificationsService } from '../../../../core/services/push/push-notifications.service';
import { PermissionsModal } from './permissions-modal';

describe('PermissionsModal', () => {
  let fixture: ComponentFixture<PermissionsModal>;
  const enable = vi.fn();
  const requestDevicePermission = vi.fn();
  const dismiss = vi.fn().mockResolvedValue(true);

  function render(inputs: Partial<PermissionsModal>): PermissionsModal {
    TestBed.configureTestingModule({
      imports: [PermissionsModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: PushNotificationsService, useValue: { enable } },
        { provide: LocationService, useValue: { requestDevicePermission } },
        { provide: ModalController, useValue: { dismiss } },
        {
          provide: LegalDocumentsService,
          useValue: {
            getCurrent: vi.fn().mockResolvedValue({
              type: 'location',
              version: '1.0',
              content: '<p>Para rellenar de dónde sales.</p>',
              summary: null,
              publishedAt: null,
            }),
          },
        },
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
    requestDevicePermission.mockResolvedValue('granted');
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
    expect(requestDevicePermission).not.toHaveBeenCalled();
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

  // Solo el permiso del dispositivo: el consentimiento de la app es otra cosa
  it('asks only for the device permission of the location', async () => {
    const modal = render({ canAskLocation: true });

    await modal.handleEnableLocation();

    expect(requestDevicePermission).toHaveBeenCalledTimes(1);
    expect(modal.locationState()).toBe('done');
  });

  it('marks the location as blocked when the device permission is not given', async () => {
    const modal = render({ canAskLocation: true });
    requestDevicePermission.mockResolvedValueOnce('prompt');

    await modal.handleEnableLocation();

    expect(modal.locationState()).toBe('blocked');
  });

  it('rethrows unexpected errors when asking for the location', async () => {
    const modal = render({ canAskLocation: true });
    requestDevicePermission.mockRejectedValueOnce(new Error('boom'));

    await expect(modal.handleEnableLocation()).rejects.toThrow('boom');
    expect(modal.locationState()).toBe('idle');
  });

  it('tells a refused location apart from having no signal', async () => {
    const modal = render({ canAskLocation: true });
    requestDevicePermission.mockRejectedValueOnce(new LocationError('denied'));
    await modal.handleEnableLocation();
    expect(modal.locationState()).toBe('blocked');

    requestDevicePermission.mockRejectedValueOnce(new LocationError('unavailable'));
    await modal.handleEnableLocation();
    expect(modal.locationState()).toBe('done');
  });

  // Sin abrir otra ventana encima: el texto en la misma, con la flecha
  it('shows the location terms in the same window and goes back', async () => {
    const modal = render({ canAskLocation: true });
    const root = fixture.nativeElement as HTMLElement;

    modal.handleReadTerms();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Para rellenar de dónde sales.');
    });
    expect(root.querySelector('.modal-back-button')).not.toBeNull();
    expect(rows()).toBe(0);

    modal.handleCloseTerms();
    fixture.detectChanges();
    expect(rows()).toBe(1);
  });

  it('closes without asking anything else', async () => {
    await render({ canAskPush: true }).handleClose();
    expect(dismiss).toHaveBeenCalledWith(null, 'close');
    expect(enable).not.toHaveBeenCalled();
  });
});
