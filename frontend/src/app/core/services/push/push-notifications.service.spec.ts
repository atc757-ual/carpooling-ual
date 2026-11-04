import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PUSH_CHANNEL, PushPermission, PushTarget } from './push-channel';
import { PushNotificationsService } from './push-notifications.service';

describe('PushNotificationsService', () => {
  let http: HttpTestingController;
  let push: PushNotificationsService;
  let stored: Record<string, string>;
  let channel: {
    platform: 'web' | 'android';
    isAvailable: ReturnType<typeof vi.fn>;
    checkPermission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
    deleteToken: ReturnType<typeof vi.fn>;
    listen: ReturnType<typeof vi.fn>;
  };
  let beforeLogout: () => Promise<void>;
  let refreshNotices: ReturnType<typeof vi.fn>;

  const permission = (value: PushPermission) => vi.fn().mockResolvedValue(value);
  const answerToken = () =>
    vi.waitFor(() =>
      http
        .expectOne((req) => req.url === '/api/users/me/push-tokens')
        .flush(null, { status: 204, statusText: 'No Content' }),
    );

  beforeEach(() => {
    stored = {};
    refreshNotices = vi.fn().mockResolvedValue(undefined);
    channel = {
      platform: 'android',
      isAvailable: vi.fn().mockResolvedValue(true),
      checkPermission: permission('prompt'),
      requestPermission: permission('granted'),
      getToken: vi.fn().mockResolvedValue('device-token'),
      deleteToken: vi.fn().mockResolvedValue(undefined),
      listen: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PUSH_CHANNEL, useValue: channel },
        {
          provide: PreferencesPlugin,
          useValue: {
            get: (key: string) => Promise.resolve(stored[key] ?? null),
            set: (key: string, value: string) => Promise.resolve(void (stored[key] = value)),
            remove: (key: string) => Promise.resolve(void delete stored[key]),
          },
        },
        {
          provide: AuthService,
          useValue: { onBeforeLogout: (task: () => Promise<void>) => (beforeLogout = task) },
        },
        { provide: NotificationsService, useValue: { refreshUnread: refreshNotices } },
        { provide: ChatService, useValue: { refreshUnread: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    push = TestBed.inject(PushNotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('turns them on asking for permission and registers the token with its platform', async () => {
    const enabling = push.enable();
    await vi.waitFor(() => {
      const put = http.expectOne('/api/users/me/push-tokens');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ token: 'device-token', platform: 'android' });
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    await expect(enabling).resolves.toBe(true);
    expect(push.status()).toBe('on');
    expect(stored['push.token']).toBe('device-token');
  });

  it('stays off when the permission is not given, and says when it is blocked', async () => {
    channel.requestPermission = permission('prompt');
    await expect(push.enable()).resolves.toBe(false);
    expect(push.status()).toBe('off');

    channel.requestPermission = permission('denied');
    await expect(push.enable()).resolves.toBe(false);
    expect(push.status()).toBe('denied');
  });

  it('turns them off removing the token from the API and the device', async () => {
    stored['push.token'] = 'device-token';
    const disabling = push.disable();
    await vi.waitFor(() => {
      const del = http.expectOne((req) => req.url === '/api/users/me/push-tokens');
      expect(del.request.method).toBe('DELETE');
      expect(del.request.params.get('token')).toBe('device-token');
      del.flush(null, { status: 204, statusText: 'No Content' });
    });
    await disabling;

    expect(channel.deleteToken).toHaveBeenCalled();
    expect(stored['push.token']).toBeUndefined();
    expect(push.status()).toBe('off');
  });

  it('removes the token before logging out, and does nothing without one', async () => {
    await beforeLogout();
    stored['push.token'] = 'device-token';

    const loggingOut = beforeLogout();
    await answerToken();
    await loggingOut;
    expect(stored['push.token']).toBeUndefined();
  });

  it('on start, renews the token when they were on and knows when they are blocked or missing', async () => {
    stored['push.token'] = 'old-token';
    channel.checkPermission = permission('granted');
    const starting = push.start();
    await answerToken();
    await starting;
    expect(push.status()).toBe('on');

    channel.checkPermission = permission('denied');
    await push.start();
    expect(push.status()).toBe('denied');

    channel.isAvailable.mockRejectedValue(new Error('no push'));
    await push.start();
    expect(push.status()).toBe('unsupported');
    await expect(push.enable()).resolves.toBe(false);
  });

  it('refreshes the notices when a push arrives with the app open, and opens a pressed one', async () => {
    await push.start();
    await push.start();
    const handler = vi.fn();
    push.onOpen(handler);

    expect(channel.listen).toHaveBeenCalledTimes(1);
    const [[onReceive, onTap]] = channel.listen.mock.calls as [
      [() => void, (target: PushTarget) => void],
    ];
    onReceive();
    onTap({ type: 'chat_message', tripId: 't1' });

    expect(refreshNotices).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith({ type: 'chat_message', tripId: 't1' });
  });
});
