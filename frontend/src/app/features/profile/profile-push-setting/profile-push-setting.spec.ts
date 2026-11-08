import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import {
  PushNotificationsService,
  PushStatus,
} from '../../../core/services/push/push-notifications.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ProfilePushSetting } from './profile-push-setting';

describe('ProfilePushSetting', () => {
  const status = signal<PushStatus>('off');
  let push: {
    status: typeof status;
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
  };
  let toast: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };

  function render(): { component: ProfilePushSetting; root: HTMLElement; fixture: unknown } {
    TestBed.configureTestingModule({
      imports: [ProfilePushSetting],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: PushNotificationsService, useValue: push },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePushSetting);
    fixture.detectChanges();
    return {
      component: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
      fixture,
    };
  }

  beforeEach(() => {
    status.set('off');
    push = {
      status,
      enable: vi.fn().mockImplementation(() => {
        status.set('on');
        return Promise.resolve(true);
      }),
      disable: vi.fn().mockImplementation(() => {
        status.set('off');
        return Promise.resolve();
      }),
    };
    toast = { showSuccess: vi.fn(), showError: vi.fn() };
  });

  it('turns them on and says so, and turns them off', async () => {
    const { component } = render();

    await component.handleEnable();
    expect(push.enable).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalledWith('Te avisaremos aunque tengas la app cerrada.');
    expect(component.isOn()).toBe(true);

    await component.handleDisable();
    expect(push.disable).toHaveBeenCalled();
    expect(component.isBusy()).toBe(false);
  });

  it('submits form from DOM when off and clicks status button when on', async () => {
    const { root, fixture } = render();

    const form = root.querySelector('form');
    expect(form).not.toBeNull();
    form?.dispatchEvent(new Event('submit'));
    await (fixture as { whenStable: () => Promise<void> }).whenStable();

    expect(push.enable).toHaveBeenCalled();
    (fixture as { detectChanges: () => void }).detectChanges();

    const statusBtn = root.querySelector<HTMLButtonElement>('.profile-push__status-btn');
    expect(statusBtn).not.toBeNull();
    statusBtn?.dispatchEvent(new Event('click'));
    await (fixture as { whenStable: () => Promise<void> }).whenStable();

    expect(push.disable).toHaveBeenCalled();
  });

  it('does nothing when already in that state', async () => {
    const { component } = render();
    // Already off
    await component.handleDisable();
    expect(push.disable).not.toHaveBeenCalled();

    // Set to on and try enabling again
    status.set('on');
    await component.handleEnable();
    expect(push.enable).not.toHaveBeenCalled();
  });

  it('does not show success toast if push.enable resolves to false', async () => {
    push.enable.mockResolvedValue(false);
    const { component } = render();

    await component.handleEnable();
    expect(toast.showSuccess).not.toHaveBeenCalled();
  });

  it('says so when enable or disable fails', async () => {
    const { component } = render();

    push.enable.mockRejectedValue(new Error('offline'));
    await component.handleEnable();
    expect(toast.showError).toHaveBeenCalledWith('No hemos podido activar las notificaciones. Inténtalo de nuevo.');
    expect(component.isBusy()).toBe(false);

    status.set('on');
    push.disable.mockRejectedValue(new Error('offline'));
    await component.handleDisable();
    expect(toast.showError).toHaveBeenCalledWith('No hemos podido desactivar las notificaciones.');
    expect(component.isBusy()).toBe(false);
  });

  it('cannot be touched when they are blocked or not supported, and says why', () => {
    const { component } = render();
    expect(component.hintKey()).toBe('profile.pushHint');
    expect(component.isLocked()).toBe(false);

    status.set('denied');
    expect(component.hintKey()).toBe('profile.pushDenied');
    expect(component.isLocked()).toBe(true);

    status.set('unsupported');
    expect(component.hintKey()).toBe('profile.pushUnsupported');
    expect(component.isLocked()).toBe(true);
  });
});
