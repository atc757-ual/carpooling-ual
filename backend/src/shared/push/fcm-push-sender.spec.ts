import type { Messaging } from 'firebase-admin/messaging';
import { ANDROID_CHANNEL_ID, FcmPushSender } from './fcm-push-sender';

// Un mensaje enviado: a un token (Android) o a un FID (web)
interface Sent {
  token?: string;
  fid?: string;
}
const idOf = (sent: Sent): string => sent.token ?? sent.fid ?? '';

const MESSAGE = {
  title: 'Hola',
  body: 'Texto',
  data: { type: 'chat_message' },
};

describe('FcmPushSender', () => {
  const answer = (failures: Record<string, string>) =>
    jest.fn((messages: Sent[]) =>
      Promise.resolve({
        responses: messages
          .map(idOf)
          .map((id) =>
            failures[id]
              ? { success: false, error: { code: failures[id] } }
              : { success: true },
          ),
      }),
    );

  it('sends the tokens in batches of 500 and returns the ones FCM no longer accepts', async () => {
    const sendEach = answer({
      t3: 'messaging/registration-token-not-registered',
      t4: 'messaging/internal-error',
    });
    const sender = new FcmPushSender({
      sendEach,
    } as unknown as Messaging);
    const tokens = Array.from({ length: 501 }, (_, index) => `t${index}`);

    const invalid = await sender.send({ tokens, fids: [] }, MESSAGE);

    expect(sendEach).toHaveBeenCalledTimes(2);
    expect(sendEach.mock.calls[1][0].map(idOf)).toEqual(['t500']);
    expect(sendEach.mock.calls[0][0][0]).toMatchObject({
      notification: { title: 'Hola', body: 'Texto' },
      data: { type: 'chat_message' },
      android: { notification: { channelId: ANDROID_CHANNEL_ID } },
    });
    // Un error temporal (internal-error) no borra el token
    expect(invalid).toEqual(['t3']);
  });

  it('sends to the FID of the web apart from the tokens, and drops the unregistered ones', async () => {
    const sendEach = answer({
      f2: 'messaging/installation-id-not-registered',
    });
    const sender = new FcmPushSender({
      sendEach,
    } as unknown as Messaging);

    const invalid = await sender.send(
      { tokens: ['t1'], fids: ['f1', 'f2'] },
      MESSAGE,
    );

    const calls = sendEach.mock.calls.map(([sent]) => sent.map(idOf));
    expect(calls).toEqual([['f1', 'f2'], ['t1']]);
    expect(sendEach.mock.calls[0][0][0]).not.toHaveProperty('token');
    expect(invalid).toEqual(['f2']);
  });

  it('sends nothing without recipients', async () => {
    const sendEach = answer({});
    const sender = new FcmPushSender({
      sendEach,
    } as unknown as Messaging);

    await expect(
      sender.send({ tokens: [], fids: [] }, MESSAGE),
    ).resolves.toEqual([]);
    expect(sendEach).not.toHaveBeenCalled();
  });
});
