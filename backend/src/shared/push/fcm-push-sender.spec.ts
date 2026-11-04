import type { Messaging } from 'firebase-admin/messaging';
import { ANDROID_CHANNEL_ID, FcmPushSender } from './fcm-push-sender';

describe('FcmPushSender', () => {
  it('sends in batches of 500 and returns the tokens FCM no longer accepts', async () => {
    const sendEachForMulticast = jest.fn(({ tokens }: { tokens: string[] }) =>
      Promise.resolve({
        responses: tokens.map((token) => {
          if (token === 't3') {
            return {
              success: false,
              error: { code: 'messaging/registration-token-not-registered' },
            };
          }
          if (token === 't4') {
            return {
              success: false,
              error: { code: 'messaging/internal-error' },
            };
          }
          return { success: true };
        }),
      }),
    );
    const sender = new FcmPushSender({
      sendEachForMulticast,
    } as unknown as Messaging);
    const tokens = Array.from({ length: 501 }, (_, index) => `t${index}`);

    const invalid = await sender.send(tokens, {
      title: 'Hola',
      body: 'Texto',
      data: { type: 'chat_message' },
    });

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
});
