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
      es: {
        title: 'Han aceptado tu solicitud',
        body: 'Ya tienes plaza: mira la hora y el punto de recogida.',
        data: { type: 'request_accepted', tripId: 't1', requestId: 'r1' },
      },
      en: {
        title: 'Your request was accepted',
        body: 'You have a seat: check the time and the pick-up point.',
        data: { type: 'request_accepted', tripId: 't1', requestId: 'r1' },
      },
    });
    expect(
      toPushMessage({ type: 'trip_started', tripId: 't1' })?.en.data,
    ).toEqual({
      type: 'trip_started',
      tripId: 't1',
    });
  });

  it('sends the incident notices with the incident to open it', () => {
    expect(
      toPushMessage({
        type: 'incident_in_review',
        tripId: 't1',
        incidentId: 'i1',
      })?.es,
    ).toEqual({
      title: 'Estamos revisando tu reporte',
      body: 'Es posible que te escribamos al correo para ayudarte.',
      data: { type: 'incident_in_review', tripId: 't1', incidentId: 'i1' },
    });
    expect(
      toPushMessage({
        type: 'incident_reported',
        tripId: 't1',
        incidentId: 'i1',
      })?.en.title,
    ).toBe('New incident');
  });

  it('keeps the rest inside the app', () => {
    expect(
      toPushMessage({
        type: 'passenger_left',
        tripId: 't1',
        requestId: 'r1',
      }),
    ).toBeNull();
    expect(
      toPushMessage({ type: 'privacy_updated', legalDocumentId: 'd1' }),
    ).toBeNull();
  });
});
