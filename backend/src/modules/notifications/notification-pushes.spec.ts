import { toPushMessage } from './notification-pushes';

describe('toPushMessage', () => {
  it('sends the important trip notices with the ids to open them', () => {
    expect(
      toPushMessage({
        type: 'request_accepted',
        tripId: 't1',
        requestId: 'r1',
      }),
    ).toEqual({
      title: 'Han aceptado tu solicitud',
      body: 'Ya tienes plaza: mira la hora y el punto de recogida.',
      data: { type: 'request_accepted', tripId: 't1', requestId: 'r1' },
    });
    expect(toPushMessage({ type: 'trip_started', tripId: 't1' })?.data).toEqual(
      {
        type: 'trip_started',
        tripId: 't1',
      },
    );
  });

  it('keeps the rest inside the app', () => {
    expect(
      toPushMessage({
        type: 'incident_reported',
        tripId: 't1',
        incidentId: 'i1',
      }),
    ).toBeNull();
    expect(
      toPushMessage({ type: 'privacy_updated', legalDocumentId: 'd1' }),
    ).toBeNull();
  });
});
