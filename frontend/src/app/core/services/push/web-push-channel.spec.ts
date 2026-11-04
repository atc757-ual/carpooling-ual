import { vi } from 'vitest';
import { WebPushChannel } from './web-push-channel';

const firebase = vi.hoisted(() => ({
  isSupported: vi.fn(),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
  onMessage: vi.fn(),
  getMessaging: vi.fn(() => ({ messaging: true })),
}));
vi.mock('@firebase/messaging', () => firebase);
vi.mock('@firebase/app', () => ({ initializeApp: vi.fn(() => ({ app: true })) }));

describe('WebPushChannel', () => {
  let workerListener: ((event: MessageEvent) => void) | null;
  let channel: WebPushChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    workerListener = null;
    firebase.isSupported.mockResolvedValue(true);
    firebase.getToken.mockResolvedValue('browser-token');
    firebase.deleteToken.mockResolvedValue(true);
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue({ scope: '/' }),
        addEventListener: (_type: string, listener: (event: MessageEvent) => void) =>
          (workerListener = listener),
      },
    });
    channel = new WebPushChannel();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('is a web channel when the browser has notifications, a service worker and FCM', async () => {
    expect(channel.platform).toBe('web');
    await expect(channel.isAvailable()).resolves.toBe(true);
    firebase.isSupported.mockRejectedValue(new Error('no indexedDB'));
    await expect(channel.isAvailable()).resolves.toBe(false);
    Reflect.deleteProperty(navigator, 'serviceWorker');
    await expect(channel.isAvailable()).resolves.toBe(false);
  });

  it('reads and asks the browser permission', async () => {
    await expect(channel.checkPermission()).resolves.toBe('prompt');
    await expect(channel.requestPermission()).resolves.toBe('granted');
  });

  it('gets the token with the push service worker and the VAPID key, and deletes it', async () => {
    await expect(channel.getToken()).resolves.toBe('browser-token');
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/push-sw.js');
    expect(firebase.getToken).toHaveBeenCalledWith(
      { messaging: true },
      expect.objectContaining({ serviceWorkerRegistration: { scope: '/' } }) as unknown,
    );

    await channel.deleteToken();
    expect(firebase.deleteToken).toHaveBeenCalled();
    // Una sola instancia de Firebase
    expect(firebase.getMessaging).toHaveBeenCalledTimes(1);
  });

  it('tells when a push arrives and when the service worker opens one', () => {
    const onReceive = vi.fn();
    const onTap = vi.fn();
    channel.listen(onReceive, onTap);

    expect(firebase.onMessage).toHaveBeenCalledWith({ messaging: true }, onReceive);
    workerListener?.({
      data: { type: 'push-open', data: { type: 'chat_message', tripId: 't1' } },
    } as MessageEvent);
    workerListener?.({ data: { type: 'other' } } as MessageEvent);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ type: 'chat_message', tripId: 't1' });
  });
});
