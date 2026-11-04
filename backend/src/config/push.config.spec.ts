import { parsePushConfig } from './push.config';

describe('parsePushConfig', () => {
  it('keeps the pushes in memory in the tests', () => {
    expect(parsePushConfig({ NODE_ENV: 'test' })).toEqual({
      transport: 'memory',
      serviceAccountPath: null,
    });
  });

  it('sends with FCM when there is a service account, and disables them without it', () => {
    expect(
      parsePushConfig({
        FIREBASE_SERVICE_ACCOUNT_PATH: ' /secrets/firebase.json ',
      }),
    ).toEqual({
      transport: 'fcm',
      serviceAccountPath: '/secrets/firebase.json',
    });
    expect(parsePushConfig({})).toEqual({
      transport: 'disabled',
      serviceAccountPath: null,
    });
  });

  it('accepts an explicit transport and rejects a wrong one', () => {
    expect(
      parsePushConfig({
        PUSH_TRANSPORT: 'disabled',
        FIREBASE_SERVICE_ACCOUNT_PATH: '/x.json',
      }),
    ).toEqual({
      transport: 'disabled',
      serviceAccountPath: null,
    });
    expect(() => parsePushConfig({ PUSH_TRANSPORT: 'apns' })).toThrow(
      /Invalid PUSH_TRANSPORT/,
    );
    expect(() => parsePushConfig({ PUSH_TRANSPORT: 'fcm' })).toThrow(
      /FIREBASE_SERVICE_ACCOUNT_PATH/,
    );
  });
});
