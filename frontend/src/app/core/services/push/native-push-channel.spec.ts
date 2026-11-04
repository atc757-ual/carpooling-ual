import { vi } from 'vitest';
import { ANDROID_CHANNEL, NativePushChannel, NativePushPlugin } from './native-push-channel';

type Listener = (event: unknown) => void;

describe('NativePushChannel', () => {
  let listeners: Record<string, Listener>;
  let plugin: Record<keyof NativePushPlugin, ReturnType<typeof vi.fn>>;
  let channel: NativePushChannel;

  beforeEach(() => {
    listeners = {};
    plugin = {
      checkPermissions: vi.fn().mockResolvedValue({ receive: 'prompt-with-rationale' }),
      requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
      register: vi.fn().mockImplementation(() => {
        listeners['registration']?.({ value: 'fcm-token' });
        return Promise.resolve();
      }),
      unregister: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn().mockImplementation((event: string, listener: Listener) => {
        listeners[event] = listener;
        return Promise.resolve({ remove: vi.fn() });
      }),
      createChannel: vi.fn().mockResolvedValue(undefined),
    };
    channel = new NativePushChannel(plugin as unknown as NativePushPlugin);
  });

  it('is an android channel, always available, with the system permission', async () => {
    expect(channel.platform).toBe('android');
    await expect(channel.isAvailable()).resolves.toBe(true);
    await expect(channel.checkPermission()).resolves.toBe('prompt');
    await expect(channel.requestPermission()).resolves.toBe('granted');
    plugin.checkPermissions.mockResolvedValue({ receive: 'denied' });
    await expect(channel.checkPermission()).resolves.toBe('denied');
  });

  it('creates the trips channel and returns the token of the registration', async () => {
    await expect(channel.getToken()).resolves.toBe('fcm-token');
    expect(plugin.createChannel).toHaveBeenCalledWith(ANDROID_CHANNEL);
    expect(plugin.register).toHaveBeenCalled();
  });

  it('fails when the registration fails, and unregisters to delete the token', async () => {
    plugin.register.mockImplementation(() => {
      listeners['registrationError']?.({ error: 'no google services' });
      return Promise.resolve();
    });
    await expect(channel.getToken()).rejects.toThrow('no google services');

    await channel.deleteToken();
    expect(plugin.unregister).toHaveBeenCalled();
  });

  it('tells when a push arrives and when one is pressed, with its data', () => {
    const onReceive = vi.fn();
    const onTap = vi.fn();
    channel.listen(onReceive, onTap);

    listeners['pushNotificationReceived']({});
    listeners['pushNotificationActionPerformed']({
      notification: { data: { type: 'request_accepted', tripId: 't1', requestId: 'r1' } },
    });
    listeners['pushNotificationActionPerformed']({ notification: { data: {} } });

    expect(onReceive).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ type: 'request_accepted', tripId: 't1', requestId: 'r1' });
  });
});
