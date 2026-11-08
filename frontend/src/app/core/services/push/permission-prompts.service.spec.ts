import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { provideTestingTransloco } from '../../i18n/testing-transloco';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { LocationService } from '../location/location.service';
import { ConfirmService } from '../ui/confirm.service';
import { ToastService } from '../ui/toast.service';
import { PermissionPromptsService } from './permission-prompts.service';
import { PushNotificationsService, PushStatus } from './push-notifications.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('PermissionPromptsService', () => {
  const stored = new Map<string, string>();
  const status = signal<PushStatus>('off');
  const enable = vi.fn();
  const checkPermission = vi.fn();
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });
  const ask = vi.fn();
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);
  let service: PermissionPromptsService;

  beforeEach(() => {
    vi.clearAllMocks();
    stored.clear();
    status.set('off');
    checkPermission.mockResolvedValue('prompt');
    TestBed.configureTestingModule({
      providers: [
        provideTestingTransloco(),
        {
          provide: PreferencesPlugin,
          useValue: {
            get: (key: string) => Promise.resolve(stored.get(key) ?? null),
            set: (key: string, value: string) => Promise.resolve(void stored.set(key, value)),
          },
        },
        { provide: PushNotificationsService, useValue: { status, enable } },
        { provide: LocationService, useValue: { checkPermission } },
        { provide: ModalController, useValue: { create } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ToastService, useValue: { showSuccess, showError } },
      ],
    });
    service = TestBed.inject(PermissionPromptsService);
  });

  describe('offerOnEntry', () => {
    it('opens once with what can still be asked', async () => {
      status.set('on');

      await service.offerOnEntry();
      await service.offerOnEntry();

      expect(create).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0][0].componentProps).toEqual({
        canAskPush: false,
        canAskLocation: true,
      });
    });

    it('stays closed when there is nothing to ask, and can open later', async () => {
      status.set('denied');
      checkPermission.mockResolvedValue('granted');
      await service.offerOnEntry();
      expect(create).not.toHaveBeenCalled();

      status.set('off');
      await service.offerOnEntry();
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  describe('offerPush', () => {
    it('enables the notifications when accepted', async () => {
      ask.mockResolvedValue(true);
      enable.mockResolvedValue(true);

      await service.offerPush('request');

      expect(enable).toHaveBeenCalledTimes(1);
      expect(showSuccess).toHaveBeenCalledTimes(1);
    });

    it('says nothing when the browser refuses, and warns when it fails', async () => {
      ask.mockResolvedValue(true);
      enable.mockResolvedValueOnce(false);
      await service.offerPush('publish');
      expect(showSuccess).not.toHaveBeenCalled();
      expect(showError).not.toHaveBeenCalled();

      stored.clear();
      enable.mockRejectedValueOnce(new Error('no'));
      await service.offerPush('publish');
      expect(showError).toHaveBeenCalledTimes(1);
    });

    it('waits a week after being offered', async () => {
      ask.mockResolvedValue(false);
      await service.offerPush('publish');
      await service.offerPush('request');
      expect(ask).toHaveBeenCalledTimes(1);
      expect(enable).not.toHaveBeenCalled();

      stored.set('permissions.push-offered-at', String(Date.now() - WEEK_MS));
      await service.offerPush('request');
      expect(ask).toHaveBeenCalledTimes(2);
    });

    it.each(['on', 'denied', 'unsupported'] as const)('is not offered when %s', async (state) => {
      status.set(state);
      await service.offerPush('publish');
      expect(ask).not.toHaveBeenCalled();
    });
  });
});
