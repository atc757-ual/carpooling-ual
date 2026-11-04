import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushNotificationsService, WEB_MESSAGING } from './push-notifications.service';

describe('PushNotificationsService', () => {
  let http: HttpTestingController;
  let push: PushNotificationsService;
  let stored: Record<string, string>;
  let messaging: {
    isSupported: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
    deleteToken: ReturnType<typeof vi.fn>;
    onMessage: ReturnType<typeof vi.fn>;
  };
  let beforeLogout: () => Promise<void>;
  let workerListener: ((event: MessageEvent) => void) | null;
  let refreshNotices: ReturnType<typeof vi.fn>;

  function setPermission(permission: NotificationPermission, requested = permission): void {
    vi.stubGlobal('Notification', {
      permission,
      requestPermission: vi.fn().mockResolvedValue(requested),
    });
  }

  beforeEach(() => {
    stored = {};
    workerListener = null;
    refreshNotices = vi.fn().mockResolvedValue(undefined);
    messaging = {
      isSupported: vi.fn().mockResolvedValue(true),
      getToken: vi.fn().mockResolvedValue('browser-token'),
      deleteToken: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(),
    };
    setPermission('default', 'granted');
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue({}),
        addEventListener: (_type: string, listener: (event: MessageEvent) => void) =>
          (workerListener = listener),
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WEB_MESSAGING, useValue: messaging },
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
          useValue: {
            onBeforeLogout: (task: () => Promise<void>) => (beforeLogout = task),
          },
        },
        { provide: NotificationsService, useValue: { refreshUnread: refreshNotices } },
        { provide: ChatService, useValue: { refreshUnread: vi.fn().mockResolvedValue(undefined) } },
      ],
    });
    push = TestBed.inject(PushNotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  const flush = () => new Promise((resolve) => setTimeout(resolve));

  it('turns them on asking for permission and registers the token of this browser', async () => {
    const enabling = push.enable();
    await vi.waitFor(() => {
      const put = http.expectOne('/api/users/me/push-tokens');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ token: 'browser-token', platform: 'web' });
      put.flush(null, { status: 204, statusText: 'No Content' });
    });

    await expect(enabling).resolves.toBe(true);
    expect(push.status()).toBe('on');
    expect(stored['push.token']).toBe('browser-token');
  });

  it('stays off when the permission is not given, and says when it is blocked', async () => {
    setPermission('default', 'default');
    await expect(push.enable()).resolves.toBe(false);
    expect(push.status()).toBe('off');

    setPermission('default', 'denied');
    await expect(push.enable()).resolves.toBe(false);
    expect(push.status()).toBe('denied');
  });

  it('turns them off removing the token from the API and the browser', async () => {
    stored['push.token'] = 'browser-token';
    setPermission('granted');

    const disabling = push.disable();
    await vi.waitFor(() => {
      const del = http.expectOne((req) => req.url === '/api/users/me/push-tokens');
      expect(del.request.method).toBe('DELETE');
      expect(del.request.params.get('token')).toBe('browser-token');
      del.flush(null, { status: 204, statusText: 'No Content' });
    });
    await disabling;

    expect(messaging.deleteToken).toHaveBeenCalled();
    expect(stored['push.token']).toBeUndefined();
    expect(push.status()).toBe('off');
  });

  it('removes the token before logging out, and does nothing without one', async () => {
    await beforeLogout();
    stored['push.token'] = 'browser-token';

    const loggingOut = beforeLogout();
    await vi.waitFor(() =>
      http
        .expectOne((req) => req.url === '/api/users/me/push-tokens')
        .flush(null, { status: 204, statusText: 'No Content' }),
    );
    await loggingOut;
    expect(stored['push.token']).toBeUndefined();
  });

  it('on start, renews the token when they were on and knows when they are blocked or missing', async () => {
    stored['push.token'] = 'old-token';
    setPermission('granted');
    const starting = push.start();
    await vi.waitFor(() =>
      http
        .expectOne('/api/users/me/push-tokens')
        .flush(null, { status: 204, statusText: 'No Content' }),
    );
    await starting;
    expect(push.status()).toBe('on');

    setPermission('denied');
    await push.start();
    expect(push.status()).toBe('denied');

    messaging.isSupported.mockResolvedValue(false);
    await push.start();
    expect(push.status()).toBe('unsupported');
    await expect(push.enable()).resolves.toBe(false);
  });

  it('refreshes the notices when a push arrives with the app open, and opens a pressed one', async () => {
    setPermission('default');
    await push.start();
    const handler = vi.fn();
    push.onOpen(handler);

    const [[onMessage]] = messaging.onMessage.mock.calls as [[() => void]];
    onMessage();
    expect(refreshNotices).toHaveBeenCalled();

    workerListener?.({
      data: { type: 'push-open', data: { type: 'chat_message', tripId: 't1' } },
    } as MessageEvent);
    workerListener?.({ data: { type: 'other' } } as MessageEvent);
    await flush();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'chat_message', tripId: 't1' });
  });
});
