import { formatElapsed, notificationMessage, notificationMode } from './notification-texts';

describe('notification texts', () => {
  const now = new Date('2026-10-28T12:00:00');
  const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString();

  it('has a sentence for each type', () => {
    expect(notificationMessage('request_received')).toBe('Te han pedido plaza');
    expect(notificationMessage('request_accepted')).toBe('Han aceptado tu solicitud');
    expect(notificationMessage('request_conflict_cancelled')).toBe(
      'Tu solicitud se canceló al aceptar otro viaje',
    );
    expect(notificationMessage('trip_started')).toBe('Tu conductor va de camino');
    expect(notificationMessage('incident_reported')).toBe('Hay una incidencia nueva');
  });

  it('opens my trips as driver or passenger, never for incidents', () => {
    expect(notificationMode('request_received')).toBe('driver');
    expect(notificationMode('passenger_left')).toBe('driver');
    expect(notificationMode('request_rejected')).toBe('passenger');
    expect(notificationMode('request_conflict_cancelled')).toBe('passenger');
    expect(notificationMode('trip_cancelled')).toBe('passenger');
    expect(notificationMode('trip_started')).toBe('passenger');
    expect(notificationMode('incident_reported')).toBeNull();
  });

  it('says how long ago it arrived', () => {
    expect(formatElapsed(ago(30_000), now)).toBe('Ahora');
    expect(formatElapsed(ago(5 * 60_000), now)).toBe('hace 5 min');
    expect(formatElapsed(ago(3 * 3_600_000), now)).toBe('hace 3 h');
    expect(formatElapsed(ago(26 * 3_600_000), now)).toBe('Ayer');
    expect(formatElapsed('2026-10-20T09:00:00', now)).toBe('mar, 20 oct');
  });
});
