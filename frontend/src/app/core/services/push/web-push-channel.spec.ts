import { vi } from 'vitest';
import { FirebaseWeb, WebPushChannel } from './web-push-channel';

const firebase = vi.hoisted(() => ({
  isSupported: vi.fn(),
  register: vi.fn(),
  onRegistered: vi.fn(),
  unregister: vi.fn(),
  onMessage: vi.fn(),
  getMessaging: vi.fn(() => ({ messaging: true })),
  initializeApp: vi.fn(() => ({ app: true })),
}));

describe('WebPushChannel', () => {
  let workerListener: ((event: MessageEvent) => void) | null;
  let channel: WebPushChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    workerListener = null;
    firebase.isSupported.mockResolvedValue(true);
    firebase.register.mockResolvedValue(undefined);
    // Firebase entrega el FID por onRegistered en cuanto se registra
    firebase.onRegistered.mockImplementation((_m: unknown, next: (fid: string) => void) => {
      queueMicrotask(() => next('browser-fid'));
      return vi.fn();
    });
    firebase.unregister.mockResolvedValue(undefined);
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
    channel = new WebPushChannel(firebase as unknown as FirebaseWeb);
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

  it('gets the FID with the push service worker and the VAPID key, and unregisters', async () => {
    await expect(channel.getToken()).resolves.toBe('browser-fid');
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/push-sw.js');
    expect(firebase.register).toHaveBeenCalledWith(
      { messaging: true },
      expect.objectContaining({ serviceWorkerRegistration: { scope: '/' } }) as unknown,
    );

    await channel.deleteToken();
    expect(firebase.unregister).toHaveBeenCalled();
    // Una sola instancia de Firebase
    expect(firebase.getMessaging).toHaveBeenCalledTimes(1);
  });

  it('fails when the registration fails', async () => {
    firebase.onRegistered.mockReturnValue(vi.fn());
    firebase.register.mockRejectedValue('blocked');
    await expect(channel.getToken()).rejects.toThrow('blocked');
  });

  it('gives up when Firebase never delivers the FID', async () => {
    vi.useFakeTimers();
    try {
      firebase.onRegistered.mockReturnValue(vi.fn());
      const result = channel.getToken();
      const check = expect(result).rejects.toThrow('timed out');
      await vi.advanceTimersByTimeAsync(15_000);
      await check;
    } finally {
      vi.useRealTimers();
    }
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
