import { describe as describeReport } from './conversation-reports.service';

describe('describe (conversation report)', () => {
  const message = {
    authorName: 'Pía R.',
    authorRole: 'passenger' as const,
    text: 'Estoy en el portal',
    createdAt: new Date('2026-11-03T06:05:00.000Z'),
  };

  it('copies each message on its own line, after the reason', () => {
    const text = describeReport(
      {
        tripId: 't1',
        driverId: 'd1',
        messages: [
          message,
          { ...message, authorName: 'Dan', authorRole: 'driver', text: 'Voy' },
        ],
        omittedCount: 0,
      },
      'Me ha insultado',
    );

    expect(text.split('\n')).toEqual([
      'Chat del viaje denunciado. Motivo: Me ha insultado',
      '',
      '3 nov, 07:05 · Pía R. (pasajero): Estoy en el portal',
      '3 nov, 07:05 · Dan (conductor): Voy',
    ]);
  });

  it('says how many older messages were left out, and when there are none', () => {
    const conversation = {
      tripId: 't1',
      driverId: 'd1',
      messages: [message],
      omittedCount: 3,
    };
    expect(describeReport(conversation, 'Motivo largo')).toContain(
      '(3 mensajes anteriores no copiados)',
    );
    expect(
      describeReport(
        { ...conversation, messages: [], omittedCount: 0 },
        'Motivo largo',
      ),
    ).toContain('(sin mensajes)');
  });
});
