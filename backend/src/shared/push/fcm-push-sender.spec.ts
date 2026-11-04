import type { Messaging } from 'firebase-admin/messaging';
import { ANDROID_CHANNEL_ID, FcmPushSender } from './fcm-push-sender';

const MESSAGE = {
  title: 'Hola',
  body: 'Texto',
  data: { type: 'chat_message' },
};

describe('FcmPushSender', () => {
  const answer = (failures: Record<string, string>) =>
    jest.fn(({ tokens, fids }: { tokens?: string[]; fids?: string[] }) =>
      Promise.resolve({
        responses: (tokens ?? fids ?? []).map((id) =>
          failures[id]
            ? { success: false, error: { code: failures[id] } }
            : { success: true },
        ),
      }),
    );

  it('sends the tokens in batches of 500 and returns the ones FCM no longer accepts', async () => {
    const sendEachForMulticast = answer({
      t3: 'messaging/registration-token-not-registered',
      t4: 'messaging/internal-error',
    });
    const sender = new FcmPushSender({
      sendEachForMulticast,
    } as unknown as Messaging);
    const tokens = Array.from({ length: 501 }, (_, index) => `t${index}`);

    const invalid = await sender.send({ tokens, fids: [] }, MESSAGE);

    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(sendEachForMulticast.mock.calls[1][0].tokens).toEqual(['t500']);
    expect(sendEachForMulticast.mock.calls[0][0]).toMatchObject({
      notification: { title: 'Hola', body: 'Texto' },
      data: { type: 'chat_message' },
      android: { notification: { channelId: ANDROID_CHANNEL_ID } },
    });
    // Un error temporal (internal-error) no borra el token
    expect(invalid).toEqual(['t3']);
  });

  it('sends to the FID of the web apart from the tokens, and drops the unregistered ones', async () => {
    const sendEachForMulticast = answer({
      f2: 'messaging/installation-id-not-registered',
    });
    const sender = new FcmPushSender({
      sendEachForMulticast,
    } as unknown as Messaging);

    const invalid = await sender.send(
      { tokens: ['t1'], fids: ['f1', 'f2'] },
      MESSAGE,
    );

    const calls = sendEachForMulticast.mock.calls.map(([sent]) => sent);
    expect(calls).toEqual([
      expect.objectContaining({ fids: ['f1', 'f2'] }),
      expect.objectContaining({ tokens: ['t1'] }),
    ]);
    expect(calls[0]).not.toHaveProperty('tokens');
    expect(invalid).toEqual(['f2']);
  });

  it('sends nothing without recipients', async () => {
    const sendEachForMulticast = answer({});
    const sender = new FcmPushSender({
      sendEachForMulticast,
    } as unknown as Messaging);

    await expect(
      sender.send({ tokens: [], fids: [] }, MESSAGE),
    ).resolves.toEqual([]);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });
});
