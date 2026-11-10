import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { ConsentRecord, UserConsents } from '../../../core/models/user-consent.model';
import { LocationConsentService } from '../../../core/services/location/location-consent.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripSearchStateService } from '../../matching/trip-search-state.service';
import { ProfileLocation } from './profile-location';

function consents(action: 'granted' | 'revoked' | null, isOutdated = false): UserConsents {
  const location: ConsentRecord | null = action && {
    id: 'c1',
    type: 'location',
    documentVersion: '1.0',
    action,
    source: 'settings',
    recordedAt: '2026-10-31T10:00:00.000Z',
    fingerprint: 'a1b2c3d4e5f6',
    vehicleId: null,
  };
  return {
    current: { terms: null, privacy: null, location, driverDeclaration: null },
    outdated: isOutdated ? ['location'] : [],
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
  const confirm = { ask: vi.fn() };
  const tripSearch = { clear: vi.fn() };
  const toast = {
    showSuccess: vi.fn().mockResolvedValue(undefined),
    showError: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consent.load.mockResolvedValue(consents('granted'));
    TestBed.configureTestingModule({
      imports: [ProfileLocation],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: LocationConsentService, useValue: consent },
        { provide: ConfirmService, useValue: confirm },
        { provide: ToastService, useValue: toast },
        { provide: TripSearchStateService, useValue: tripSearch },
      ],
    });
    fixture = TestBed.createComponent(ProfileLocation);
  });

  it('shows the consent with its stamp', async () => {
    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.isGranted()).toBe(true);
    expect(fixture.componentInstance.stamp()).not.toBeNull();
  });

  it('shows it off after an important change of the text and opens the text', async () => {
    consent.load.mockResolvedValue(consents('granted', true));
    const create = vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
      present: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLIonModalElement);

    await fixture.componentInstance.refresh();
    fixture.detectChanges();
    await fixture.componentInstance.handleReadTerms();

    expect(fixture.componentInstance.isGranted()).toBe(false);
    expect(fixture.componentInstance.isOutdated()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'profile.location.authorizedOn',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'profile.location.outdated',
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { document: 'location' } }),
    );
  });

  it('grants the consent with the toggle', async () => {
    consent.set.mockResolvedValue(consents('granted'));

    await fixture.componentInstance.handleToggle(toggleEvent(true));

    expect(consent.set).toHaveBeenCalledWith('granted');
    expect(toast.showSuccess).toHaveBeenCalledWith('Compartes tu ubicación.');
    expect(tripSearch.clear).not.toHaveBeenCalled();
  });

  it('keeps sharing when the revocation is not confirmed', async () => {
    confirm.ask.mockResolvedValue(false);
    const event = toggleEvent(false);

    await fixture.componentInstance.handleToggle(event);

    expect(consent.set).not.toHaveBeenCalled();
    expect(event.target.checked).toBe(true);
    expect(tripSearch.clear).not.toHaveBeenCalled();
  });

  it('revokes after confirming and undoes the toggle if saving fails', async () => {
    confirm.ask.mockResolvedValue(true);
    consent.set.mockResolvedValueOnce(consents('revoked')).mockRejectedValueOnce(new Error());

    await fixture.componentInstance.handleToggle(toggleEvent(false));
    expect(toast.showSuccess).toHaveBeenCalledWith('Has dejado de compartir tu ubicación.');
    // La última búsqueda puede llevar una dirección sacada de la ubicación
    expect(tripSearch.clear).toHaveBeenCalledTimes(1);

    const failing = toggleEvent(false);
    await fixture.componentInstance.handleToggle(failing);
    expect(failing.target.checked).toBe(true);
    expect(toast.showError).toHaveBeenCalled();
    expect(tripSearch.clear).toHaveBeenCalledTimes(1);
  });

  it('renders without errors', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement).toBeTruthy();
  });
});
