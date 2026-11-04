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

  function render(): { component: ProfilePushSetting; root: HTMLElement } {
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
    return { component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
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

    await component.handleToggle(true);
    expect(push.enable).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalledWith('Te avisaremos aunque tengas la app cerrada.');
    expect(component.isOn()).toBe(true);

    await component.handleToggle(false);
    expect(push.disable).toHaveBeenCalled();
    expect(component.isBusy()).toBe(false);
  });

  it('does nothing when it is already so, and says so when it fails', async () => {
    const { component } = render();
    await component.handleToggle(false);
    expect(push.disable).not.toHaveBeenCalled();

    push.enable.mockRejectedValue(new Error('offline'));
    await component.handleToggle(true);
    expect(toast.showError).toHaveBeenCalled();
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
