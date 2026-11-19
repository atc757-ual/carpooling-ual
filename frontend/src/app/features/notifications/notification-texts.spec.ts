import { initAppTranslations } from '../../core/i18n/testing-transloco';
import { formatElapsed, legalDocumentOf, notificationMode } from './notification-texts';

describe('notification texts', () => {
  const now = new Date('2026-10-28T12:00:00');
  const ago = (ms: number): string => new Date(now.getTime() - ms).toISOString();

  beforeEach(() => initAppTranslations());

  it('opens my trips as driver or passenger, never for incidents', () => {
    expect(notificationMode('request_received')).toBe('driver');
    expect(notificationMode('passenger_left')).toBe('driver');
    expect(notificationMode('request_rejected')).toBe('passenger');
    expect(notificationMode('request_conflict_cancelled')).toBe('passenger');
    expect(notificationMode('trip_cancelled')).toBe('passenger');
    expect(notificationMode('trip_started')).toBe('passenger');
    expect(notificationMode('incident_reported')).toBeNull();
  });

  it('tells which legal document a minor change notice opens', () => {
    expect(notificationMode('privacy_updated')).toBeNull();
    expect(legalDocumentOf('terms_updated')).toBe('terms');
    expect(legalDocumentOf('privacy_updated')).toBe('privacy');
    expect(legalDocumentOf('request_received')).toBeNull();
  });

  it('says how long ago it arrived', () => {
    expect(formatElapsed(ago(30_000), now)).toBe('Ahora');
    expect(formatElapsed(ago(5 * 60_000), now)).toBe('hace 5 min');
    expect(formatElapsed(ago(3 * 3_600_000), now)).toBe('hace 3 h');
    expect(formatElapsed(ago(26 * 3_600_000), now)).toBe('Ayer');
    expect(formatElapsed('2026-10-20T09:00:00', now)).toBe('mar, 20 oct');
  });
});
