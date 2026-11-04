import { DisabledPushSender } from './disabled-push-sender';
import { MemoryPushSender } from './memory-push-sender';
import { createPushSender } from './push.module';

describe('createPushSender', () => {
  it('keeps the pushes in memory or does not send them', async () => {
    expect(
      createPushSender({ transport: 'memory', serviceAccountPath: null }),
    ).toBeInstanceOf(MemoryPushSender);
    const disabled = createPushSender({
      transport: 'disabled',
      serviceAccountPath: null,
    });
    expect(disabled).toBeInstanceOf(DisabledPushSender);
    await expect(
      disabled.send(
        { tokens: ['t1'], fids: [] },
        { title: 'Hola', body: 'Texto', data: {} },
      ),
    ).resolves.toEqual([]);
  });

  it('fails at startup when the service account cannot be read', () => {
    expect(() =>
      createPushSender({
        transport: 'fcm',
        serviceAccountPath: '/does/not/exist.json',
      }),
    ).toThrow();
  });
});
